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

// Хранилище для экспертов и их ранжирований
let experts = []; // [{ id, name, rankings: [{ bookId, rank }], deletedBooks: [bookId] }]
let expertIdCounter = 1;

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

// Функция для получения списка книг (дублируем логику из /api/books)
function getBooks() {
  return [
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
}

// API для получения списка книг
app.get('/api/books', (req, res) => {
  res.json(getBooks());
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

// API для получения списка экспертов
app.get('/api/experts', (req, res) => {
  res.json(experts);
});

// API для создания нового эксперта
app.post('/api/experts', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Ім\'я експерта обов\'язкове' });
  }
  
  const expert = {
    id: expertIdCounter++,
    name: name.trim(),
    rankings: [],
    deletedBooks: [],
    createdAt: new Date().toISOString()
  };
  
  experts.push(expert);
  res.json(expert);
});

// API для получения ранжирования конкретного эксперта
app.get('/api/experts/:expertId/ranking', (req, res) => {
  const expertId = parseInt(req.params.expertId);
  const expert = experts.find(e => e.id === expertId);
  
  if (!expert) {
    return res.status(404).json({ error: 'Експерт не знайдений' });
  }
  
  res.json({
    rankings: expert.rankings,
    deletedBooks: expert.deletedBooks
  });
});

// API для сохранения ранжирования эксперта
app.post('/api/experts/:expertId/ranking', (req, res) => {
  const expertId = parseInt(req.params.expertId);
  const expert = experts.find(e => e.id === expertId);
  
  if (!expert) {
    return res.status(404).json({ error: 'Експерт не знайдений' });
  }
  
  const { rankings, deletedBooks } = req.body;
  
  expert.rankings = rankings || [];
  expert.deletedBooks = deletedBooks || [];
  expert.updatedAt = new Date().toISOString();
  
  res.json({ success: true, expert });
});

// API для получения матрицы ранжирований всех экспертов
app.get('/api/experts-rankings-matrix', async (req, res) => {
  try {
    // Получаем список всех книг
    const books = getBooks();
    
    // Создаем матрицу: строки - книги, столбцы - эксперты
    const matrix = books.map(book => {
      const row = {
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        expertRankings: experts.map(expert => {
          const ranking = expert.rankings.find(r => r.bookId === book.id);
          const isDeleted = expert.deletedBooks.includes(book.id);
          return {
            expertId: expert.id,
            expertName: expert.name,
            rank: ranking ? ranking.rank : null,
            isDeleted: isDeleted
          };
        })
      };
      return row;
    });
    
    res.json({ matrix, experts, books });
  } catch (error) {
    console.error('Помилка отримання матриці ранжувань:', error);
    res.status(500).json({ error: 'Помилка при отриманні матриці' });
  }
});

// API для вычисления компромисных ранжирований
app.post('/api/compute-compromise-rankings', async (req, res) => {
  try {
    const { method } = req.body; // 'kemeny-snell', 'cook-seiford', 'minimax', 'gv-median'
    
    // Получаем список всех книг
    const books = getBooks();
    
    // Получаем ранжирования всех экспертов
    const expertRankings = experts.map(expert => ({
      expertId: expert.id,
      expertName: expert.name,
      rankings: expert.rankings,
      deletedBooks: expert.deletedBooks
    }));
    
    // Вычисляем компромисное ранжирование
    const result = computeCompromiseRanking(books, expertRankings, method);
    
    res.json(result);
  } catch (error) {
    console.error('Помилка обчислення компромісного ранжування:', error);
    res.status(500).json({ error: 'Помилка при обчисленні' });
  }
});

// Функция для вычисления компромисного ранжирования
function computeCompromiseRanking(books, expertRankings, method) {
  const n = books.length;
  const k = expertRankings.length;
  
  if (k === 0) {
    return { error: 'Немає експертів' };
  }
  
  // Создаем матрицы парных сравнений для каждого эксперта
  const expertMatrices = expertRankings.map(expert => {
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Заполняем матрицу на основе ранжирования
    // Сначала устанавливаем все значения на основе рангов
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 0;
        } else {
          const bookI = books[i];
          const bookJ = books[j];
          
          const rankingI = expert.rankings.find(r => r.bookId === bookI.id);
          const rankingJ = expert.rankings.find(r => r.bookId === bookJ.id);
          
          // Если книга удалена экспертом, не учитываем её
          if (expert.deletedBooks.includes(bookI.id) || expert.deletedBooks.includes(bookJ.id)) {
            matrix[i][j] = 0;
          } else if (rankingI && rankingJ) {
            if (rankingI.rank < rankingJ.rank) {
              matrix[i][j] = 1; // bookI лучше bookJ
            } else if (rankingI.rank > rankingJ.rank) {
              matrix[i][j] = -1;
            } else {
              matrix[i][j] = 0;
            }
          } else {
            matrix[i][j] = 0;
          }
        }
      }
    }
    
    return matrix;
  });
  
  // Вычисляем расстояния (метрика Хемминга)
  const distances = [];
  const allPossibleRankings = generateAllRankings(n);
  
  allPossibleRankings.forEach(ranking => {
    const rankingMatrix = rankingToMatrix(ranking, n);
    let totalDistance = 0;
    let maxDistance = 0;
    
    expertMatrices.forEach((expertMatrix, expertIndex) => {
      const distance = hammingDistance(rankingMatrix, expertMatrix, n);
      totalDistance += distance;
      maxDistance = Math.max(maxDistance, distance);
    });
    
    distances.push({
      ranking: [...ranking], // Копируем массив
      totalDistance,
      maxDistance,
      avgDistance: totalDistance / k
    });
  });
  
  if (distances.length === 0) {
    return { error: 'Не вдалося згенерувати ранжування' };
  }
  
  // Выбираем оптимальное ранжирование в зависимости от метода
  let optimalRanking;
  if (method === 'kemeny-snell' || method === 'cook-seiford') {
    // Минимизируем сумму расстояний
    optimalRanking = distances.reduce((min, d) => 
      d.totalDistance < min.totalDistance ? d : min
    );
  } else if (method === 'minimax' || method === 'gv-median') {
    // Минимизируем максимальное расстояние
    optimalRanking = distances.reduce((min, d) => 
      d.maxDistance < min.maxDistance ? d : min
    );
  } else {
    // По умолчанию - медиана Кемени-Снела
    optimalRanking = distances.reduce((min, d) => 
      d.totalDistance < min.totalDistance ? d : min
    );
  }
  
  // Вычисляем коэффициенты компетентности экспертов
  const optimalMatrix = rankingToMatrix(optimalRanking.ranking, n);
  const competenceCoefficients = expertMatrices.map((expertMatrix, index) => {
    const distance = hammingDistance(optimalMatrix, expertMatrix, n);
    return {
      expertId: expertRankings[index].expertId,
      expertName: expertRankings[index].expertName,
      distance: distance,
      competence: 1 / (1 + distance) // Нормализованный коэффициент
    };
  });
  
  // Нормализуем коэффициенты компетентности
  const totalCompetence = competenceCoefficients.reduce((sum, c) => sum + c.competence, 0);
  if (totalCompetence > 0) {
    competenceCoefficients.forEach(c => {
      c.competence = c.competence / totalCompetence;
    });
  }
  
  // Создаем массив результатов с правильным порядком книг
  const rankingResults = [];
  for (let rank = 1; rank <= n; rank++) {
    const bookIndex = optimalRanking.ranking.findIndex(r => r === rank);
    if (bookIndex !== -1) {
      rankingResults.push({
        bookId: books[bookIndex].id,
        bookTitle: books[bookIndex].title,
        rank: rank
      });
    }
  }
  
  return {
    method,
    optimalRanking: rankingResults,
    totalDistance: optimalRanking.totalDistance,
    maxDistance: optimalRanking.maxDistance,
    avgDistance: optimalRanking.avgDistance,
    competenceCoefficients
  };
}

// Генерация всех возможных ранжирований (для малых n)
function generateAllRankings(n) {
  if (n > 6) {
    // Для больших n используем эвристику
    return generateHeuristicRankings(n);
  }
  
  const rankings = [];
  const indices = Array.from({ length: n }, (_, i) => i);
  
  function permute(arr, start = 0) {
    if (start === arr.length - 1) {
      rankings.push([...arr]);
      return;
    }
    
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  }
  
  permute(indices);
  return rankings.map(ranking => ranking.map((_, i) => i + 1));
}

// Эвристическая генерация ранжирований для больших n
function generateHeuristicRankings(n) {
  // Генерируем ограниченное количество ранжирований на основе средних рангов
  const rankings = [];
  const baseRanking = Array.from({ length: n }, (_, i) => i + 1);
  rankings.push([...baseRanking]);
  
  // Добавляем несколько вариаций
  for (let i = 0; i < Math.min(100, factorial(n)); i++) {
    const ranking = [...baseRanking];
    // Случайные перестановки
    for (let j = 0; j < n; j++) {
      const k = Math.floor(Math.random() * n);
      [ranking[j], ranking[k]] = [ranking[k], ranking[j]];
    }
    rankings.push(ranking);
  }
  
  return rankings;
}

function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// Преобразование ранжирования в матрицу парных сравнений
// ranking - массив рангов для каждой книги (индекс = позиция книги в массиве books)
function rankingToMatrix(ranking, n) {
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else if (ranking[i] < ranking[j]) {
        matrix[i][j] = 1; // i лучше j
        matrix[j][i] = -1;
      } else if (ranking[i] > ranking[j]) {
        matrix[i][j] = -1;
        matrix[j][i] = 1;
      } else {
        matrix[i][j] = 0;
        matrix[j][i] = 0;
      }
    }
  }
  
  return matrix;
}

// Вычисление расстояния Хемминга между двумя матрицами
function hammingDistance(matrix1, matrix2, n) {
  let distance = 0;
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (matrix1[i][j] !== matrix2[i][j]) {
        distance += Math.abs(matrix1[i][j] - matrix2[i][j]);
      }
    }
  }
  
  return distance / 2; // Делим на 2, так как учитываем каждую пару дважды
}

// API для экспорта матрицы ранжирований экспертов в Excel
app.post('/api/export-experts-matrix', async (req, res) => {
  try {
    const books = getBooks();
    
    const wb = XLSX.utils.book_new();
    
    // Создаем матрицу ранжирований
    const excelData = [];
    
    // Заголовок
    const header = ['Початковий номер', 'Назва об\'єкта', ...experts.map(e => e.name)];
    excelData.push(header);
    
    // Данные
    books.forEach((book, index) => {
      const row = [
        index + 1,
        book.title,
        ...experts.map(expert => {
          const ranking = expert.rankings.find(r => r.bookId === book.id);
          if (expert.deletedBooks.includes(book.id)) {
            return 'ВИДАЛЕНО';
          }
          return ranking ? ranking.rank : '-';
        })
      ];
      excelData.push(row);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const colWidths = [
      { wch: 15 },
      { wch: 25 },
      ...experts.map(() => ({ wch: 15 }))
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Матриця ранжувань');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="experts_rankings_matrix.xlsx"');
    res.send(buffer);
    
  } catch (error) {
    console.error('Помилка експорту:', error);
    res.status(500).json({ error: 'Помилка при експорті матриці' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
