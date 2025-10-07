const express = require('express');
const path = require('path');
const sass = require('sass');
const fs = require('fs');
const XLSX = require('xlsx');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для статических файлов
app.use(express.static('public'));
app.use(express.json());

// Настройка multer для загрузки файлов
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Тільки Excel файли дозволені'), false);
    }
  }
});

// Компиляция SCSS в CSS
function compileSCSS() {
  try {
    const scssFile = path.join(__dirname, 'src', 'styles', 'main.scss');
    const cssFile = path.join(__dirname, 'public', 'css', 'style.css');
    
    // Создаем директорию если не существует
    const cssDir = path.dirname(cssFile);
    if (!fs.existsSync(cssDir)) {
      fs.mkdirSync(cssDir, { recursive: true });
    }
    
    const result = sass.compile(scssFile);
    fs.writeFileSync(cssFile, result.css);
    console.log('SCSS compiled successfully');
  } catch (error) {
    console.error('SCSS compilation error:', error);
  }
}

// Компилируем SCSS при запуске
compileSCSS();

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API для получения списка книг
app.get('/api/books', (req, res) => {
  const books = [
    { 
      id: 1, 
      title: "Гаррі Поттер", 
      author: "Дж. К. Роулінг", 
      color: "#FF6B6B", 
      image: "https://covers.openlibrary.org/b/isbn/9780747532699-M.jpg" 
    },
    { 
      id: 2, 
      title: "Володар кілець", 
      author: "Дж. Р. Р. Толкін", 
      color: "#4ECDC4", 
      image: "https://covers.openlibrary.org/b/isbn/9780544003415-M.jpg" 
    },
    { 
      id: 3, 
      title: "1984", 
      author: "Джордж Оруелл", 
      color: "#45B7D1", 
      image: "https://covers.openlibrary.org/b/isbn/9780451524935-M.jpg" 
    },
    { 
      id: 4, 
      title: "Великий Гетсбі", 
      author: "Френсіс Скотт Фіцджеральд", 
      color: "#96CEB4", 
      image: "https://covers.openlibrary.org/b/isbn/9780743273565-M.jpg" 
    },
    { 
      id: 5, 
      title: "Гордість і упередження", 
      author: "Джейн Остін", 
      color: "#FFEAA7", 
      image: "https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg" 
    },
    { 
      id: 6, 
      title: "Мобі Дік", 
      author: "Герман Мелвілл", 
      color: "#DDA0DD", 
      image: "https://covers.openlibrary.org/b/isbn/9780142437247-M.jpg" 
    }
  ];
  res.json(books);
});

// API для экспорта матрицы в Excel
app.post('/api/export-matrix', (req, res) => {
  try {
    const { matrix, books } = req.body;
    
    // Создаем рабочую книгу
    const wb = XLSX.utils.book_new();
    
    // Подготавливаем данные для Excel
    const excelData = [];
    
    // Заголовок с названиями книг
    const header = ['', ...books.map(book => book.title)];
    excelData.push(header);
    
    // Данные матрицы
    books.forEach((book, rowIndex) => {
      const row = [book.title];
      books.forEach((_, colIndex) => {
        row.push(matrix[rowIndex][colIndex] || 0);
      });
      excelData.push(row);
    });
    
    // Создаем лист
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    // Настройка ширины колонок
    const colWidths = [{ wch: 20 }]; // Первая колонка для названий
    books.forEach(() => colWidths.push({ wch: 8 })); // Колонки для значений
    ws['!cols'] = colWidths;
    
    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(wb, ws, 'Матрица сравнения');
    
    // Генерируем буфер
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Отправляем файл
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="comparison_matrix.xlsx"');
    res.send(buffer);
    
  } catch (error) {
    console.error('Ошибка экспорта:', error);
    res.status(500).json({ error: 'Ошибка при экспорте матрицы' });
  }
});

// API для импорта матрицы из Excel
app.post('/api/import-matrix', upload.single('excelFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    // Читаем Excel файл
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Конвертируем в JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Очищаем временный файл
    fs.unlinkSync(req.file.path);
    
    // Обрабатываем данные
    if (jsonData.length < 2) {
      return res.status(400).json({ error: 'Недостаточно данных в файле' });
    }
    
    const header = jsonData[0];
    const matrixData = jsonData.slice(1);
    
    // Извлекаем названия книг (пропускаем первую пустую ячейку)
    const bookTitles = header.slice(1);
    
    // Создаем матрицу
    const matrix = matrixData.map(row => row.slice(1));
    
    // Создаем новые книги на основе названий из Excel
    const newBooks = bookTitles.map((title, index) => ({
      id: index + 1,
      title: title,
      author: `Автор ${index + 1}`, // Временный автор, можно будет обновить
      color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`, // Случайный цвет
      image: null // Без изображения по умолчанию
    }));
    
    res.json({
      success: true,
      newBooks,
      matrix,
      bookTitles
    });
    
  } catch (error) {
    console.error('Ошибка импорта:', error);
    res.status(500).json({ error: 'Ошибка при импорте файла' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
