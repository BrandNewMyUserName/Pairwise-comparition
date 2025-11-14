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

// Хранилище для книг (динамічне, можна додавати нові)
let books = [
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
let nextBookId = 7; // Наступний ID для нової книги

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

// Функция для получения списка книг
function getBooks() {
  return books;
}

// API для получения списка книг
app.get('/api/books', (req, res) => {
  res.json(books);
});

// API для добавления новой книги
app.post('/api/books', (req, res) => {
  try {
    const { title, author, color, image } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Назва книги обов\'язкова' });
    }
    
    if (!author || !author.trim()) {
      return res.status(400).json({ error: 'Автор обов\'язковий' });
    }
    
    const newBook = {
      id: nextBookId++,
      title: title.trim(),
      author: author.trim(),
      color: color || `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
      image: image && image.trim() ? image.trim() : null
    };
    
    books.push(newBook);
    
    console.log('Додано нову книгу:', newBook);
    
    res.json(newBook);
  } catch (error) {
    console.error('Помилка додавання книги:', error);
    res.status(500).json({ error: 'Помилка при додаванні книги' });
  }
});

// API для удаления книги
app.delete('/api/books/:bookId', (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const bookIndex = books.findIndex(b => b.id === bookId);
    
    if (bookIndex === -1) {
      return res.status(404).json({ error: 'Книга не знайдена' });
    }
    
    // Видаляємо книгу зі списку
    const deletedBook = books.splice(bookIndex, 1)[0];
    
    // Видаляємо книгу з ранжувань всіх експертів
    experts.forEach(expert => {
      expert.rankings = expert.rankings.filter(r => r.bookId !== bookId);
      if (!expert.deletedBooks.includes(bookId)) {
        expert.deletedBooks.push(bookId);
      }
    });
    
    console.log('Видалено книгу:', deletedBook);
    
    res.json({ success: true, deletedBook });
  } catch (error) {
    console.error('Помилка видалення книги:', error);
    res.status(500).json({ error: 'Помилка при видаленні книги' });
  }
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
    // Додаємо початковий номер книги (індекс + 1 в масиві books)
    const matrix = books.map((book, index) => {
      const row = {
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        originalNumber: index + 1, // Початковий номер об'єкта
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
    
    console.log('=== ОБЧИСЛЕННЯ КОМПРОМІСНОГО РАНЖУВАННЯ ===');
    console.log('Метод:', method);
    console.log('Тип методу:', typeof method);
    
    // Получаем список всех книг
    const books = getBooks();
    
    // Получаем ранжирования всех экспертов
    const expertRankings = experts.map(expert => ({
      expertId: expert.id,
      expertName: expert.name,
      rankings: expert.rankings,
      deletedBooks: expert.deletedBooks
    }));
    
    console.log('Кількість експертів:', expertRankings.length);
    console.log('Кількість книг:', books.length);
    
    // Вычисляем компромисное ранжирование
    const result = computeCompromiseRanking(books, expertRankings, method);
    
    console.log('Результат обчислення:', {
      method: result.method,
      totalDistance: result.totalDistance,
      maxDistance: result.maxDistance,
      optimalRankingCount: result.optimalRanking?.length
    });
    console.log('==========================================');
    
    res.json(result);
  } catch (error) {
    console.error('Помилка обчислення компромісного ранжування:', error);
    res.status(500).json({ error: 'Помилка при обчисленні' });
  }
});

// Функции для вычисления расстояний (из results.js)
function cookDistance(orderA, orderB, ids) {
  let d = 0;
  ids.forEach((id) => {
    const a = orderA.indexOf(id);
    const b = orderB.indexOf(id);
    if (a >= 0 && b >= 0) d += Math.abs(a - b);
  });
  return d;
}

function pairwiseVector(order, ids) {
  const pos = new Map();
  ids.forEach((id) => pos.set(id, order.indexOf(id)));
  const v = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const pi = pos.get(ids[i]);
      const pj = pos.get(ids[j]);
      v.push(pi >= 0 && pj >= 0 ? (pi < pj ? 1 : -1) : 0);
    }
  }
  return v;
}

function hammingDistanceFromOrders(orderA, orderB, ids) {
  const a = pairwiseVector(orderA, ids);
  const b = pairwiseVector(orderB, ids);
  let s = 0;
  for (let t = 0; t < a.length; t++) s += Math.abs(a[t] - b[t]);
  return s;
}

// Функция для вычисления компромисного ранжирования
function computeCompromiseRanking(books, expertRankings, method) {
  const n = books.length;
  const k = expertRankings.length;
  
  if (k === 0) {
    return { error: 'Немає експертів' };
  }
  
  // Визначаємо ID книг, які присутні у всіх експертів (не видалені жодним)
  const allBookIds = books.map(b => b.id);
  const validBookIds = allBookIds.filter(id =>
    expertRankings.every(expert => !expert.deletedBooks.includes(id))
  );
  
  if (validBookIds.length === 0) {
    return { error: 'Немає книг, які присутні у всіх експертів' };
  }
  
  // Перетворюємо ранжування експертів у порядки (масиви ID)
  const expertOrders = expertRankings.map(expert => {
    // Створюємо масив об'єктів {bookId, rank}
    const rankedBooks = expert.rankings
      .filter(r => validBookIds.includes(r.bookId))
      .sort((a, b) => a.rank - b.rank);
    
    // Повертаємо порядок ID
    return rankedBooks.map(r => r.bookId);
  });
  
  // Генеруємо всі можливі перестановки валідних книг
  const { permutations: allPermutations, total, cap, isLimited } = generatePermutationsWithCap(validBookIds);
  
  if (allPermutations.length === 0) {
    return { error: 'Не вдалося згенерувати перестановки' };
  }
  
  // Додаємо попередження, якщо обмежено
  const warning = isLimited ? `Увага: n=${validBookIds.length}, всього перестановок ${total.toLocaleString()} — аналізуємо ${cap.toLocaleString()}.` : null;
  
  // Визначаємо функцію відстані та критерій залежно від методу
  let distFn;
  let useSum;
  let methodName;
  
  // Нормалізуємо назву методу (на випадок пробілів або інших символів)
  const normalizedMethod = String(method).trim().toLowerCase();
  
  if (normalizedMethod === 'cook-seiford') {
    // Медіана Кука-Сейфорда: метрика неспівпадання рангів + адитивний критерій
    distFn = cookDistance;
    useSum = true;
    methodName = 'Медіана Кука-Сейфорда';
  } else if (normalizedMethod === 'kemeny-snell') {
    // Медіана Кемені-Снела: метрика Хеммінга + адитивний критерій
    distFn = hammingDistanceFromOrders;
    useSum = true;
    methodName = 'Медіана Кемені-Снела';
  } else if (normalizedMethod === 'minimax') {
    // Мінімаксна медіана: метрика Хеммінга + мінімаксний критерій
    distFn = hammingDistanceFromOrders;
    useSum = false;
    methodName = 'Мінімаксна медіана';
  } else if (normalizedMethod === 'gv-median') {
    // ГВ-медіана: метрика Хеммінга + мінімаксний критерій
    distFn = hammingDistanceFromOrders;
    useSum = false;
    methodName = 'ГВ-медіана';
  } else {
    // За замовчуванням - медіана Кемені-Снела
    console.warn(`Невідомий метод: ${method}, використовується медіана Кемені-Снела`);
    distFn = hammingDistanceFromOrders;
    useSum = true;
    methodName = 'Медіана Кемені-Снела (за замовчуванням)';
  }
  
  console.log(`Обчислення методом: ${methodName} (${normalizedMethod})`);
  console.log(`Використовується метрика: ${distFn === cookDistance ? 'Cook (неспівпадання рангів)' : 'Hamming (Хеммінга)'}`);
  console.log(`Критерій: ${useSum ? 'Адитивний (сума)' : 'Мінімаксний (максимум)'}`);
  
  let bestVal = Infinity;
  let bestPermutations = [];
  
  // Обчислюємо відстані для кожної перестановки
  allPermutations.forEach((perm, idx) => {
    const dists = expertOrders.map(expertOrder =>
      distFn(perm, expertOrder, validBookIds)
    );
    const sum = dists.reduce((a, b) => a + b, 0);
    const max = Math.max(...dists);
    const score = useSum ? sum : max;
    
    if (score < bestVal) {
      bestVal = score;
      bestPermutations = [{ perm, dists, sum, max, index: idx + 1 }];
    } else if (score === bestVal) {
      bestPermutations.push({ perm, dists, sum, max, index: idx + 1 });
    }
  });
  
  console.log(`Знайдено ${bestPermutations.length} оптимальних перестановок з score=${bestVal}`);
  
  if (bestPermutations.length === 0) {
    return { error: 'Не знайдено оптимального ранжування' };
  }
  
  // Вибираємо першу найкращу перестановку
  const best = bestPermutations[0];
  
  // Створюємо результат у форматі ранжування
  // Додаємо початковий номер книги для узгодженості з матрицею
  const rankingResults = [];
  best.perm.forEach((bookId, position) => {
    const book = books.find(b => b.id === bookId);
    if (book) {
      // Знаходимо початковий номер книги (індекс + 1 в масиві books)
      const originalIndex = books.findIndex(b => b.id === bookId);
      rankingResults.push({
        bookId: book.id,
        bookTitle: book.title,
        rank: position + 1, // Ранг у оптимальному ранжуванні
        originalNumber: originalIndex + 1 // Початковий номер об'єкта
      });
    }
  });
  
  // Обчислюємо коефіцієнти компетентності
  const competenceCoefficients = expertOrders.map((expertOrder, index) => {
    const distance = distFn(best.perm, expertOrder, validBookIds);
    return {
      expertId: expertRankings[index].expertId,
      expertName: expertRankings[index].expertName,
      distance: distance,
      competence: 1 / (1 + distance)
    };
  });
  
  // Нормалізуємо коефіцієнти компетентності
  const totalCompetence = competenceCoefficients.reduce((sum, c) => sum + c.competence, 0);
  if (totalCompetence > 0) {
    competenceCoefficients.forEach(c => {
      c.competence = c.competence / totalCompetence;
    });
  }
  
  return {
    method: normalizedMethod, // Використовуємо нормалізований метод
    methodName: methodName, // Додаємо читабельну назву
    optimalRanking: rankingResults,
    totalDistance: best.sum,
    maxDistance: best.max,
    avgDistance: best.sum / k,
    competenceCoefficients,
    bestPermutationsCount: bestPermutations.length,
    warning: warning,
    // Додаємо інформацію про використану метрику та критерій для відлагодження
    debug: {
      metric: distFn === cookDistance ? 'Cook' : 'Hamming',
      criterion: useSum ? 'Sum' : 'Max',
      bestScore: bestVal
    }
  };
}

// Генерация всех возможных перестановок (из results.js)
function generatePermutations(arr, cap = Infinity) {
  const out = [];
  (function bt(a, l) {
    if (out.length >= cap) return;
    if (l === a.length) {
      out.push(a.slice());
      return;
    }
    for (let i = l; i < a.length; i++) {
      [a[l], a[i]] = [a[i], a[l]];
      bt(a, l + 1);
      [a[l], a[i]] = [a[i], a[l]];
      if (out.length >= cap) return;
    }
  })(arr.slice(), 0);
  return out;
}

function factorialSafe(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// Функция для генерации перестановок з обмеженням для великих n
function generatePermutationsWithCap(ids) {
  const n = ids.length;
  const hardCap = 40000000;
  const softCap = 10000;
  const total = factorialSafe(n);
  const cap = Math.min(total, hardCap);
  
  return {
    permutations: generatePermutations(ids, cap),
    total,
    cap,
    isLimited: total > softCap
  };
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
    
    // Данные - використовуємо початковий номер (індекс + 1)
    books.forEach((book, index) => {
      const row = [
        index + 1, // Початковий номер об'єкта
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
