const express = require('express');
const path = require('path');
const sass = require('sass');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для статических файлов
app.use(express.static('public'));
app.use(express.json());

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
    { id: 1, title: "Війна і мир", author: "Лев Толстой", color: "#FF6B6B", image: "https://covers.openlibrary.org/b/isbn/9780140447934-M.jpg" },
    { id: 2, title: "1984", author: "Джордж Оруелл", color: "#4ECDC4", image: "https://covers.openlibrary.org/b/isbn/9780451524935-M.jpg" },
    { id: 3, title: "Майстер і Маргарита", author: "Михайло Булгаков", color: "#45B7D1", image: "https://covers.openlibrary.org/b/isbn/9780141180144-M.jpg" },
    { id: 4, title: "Злочин і кара", author: "Федір Достоєвський", color: "#96CEB4", image: "https://covers.openlibrary.org/b/isbn/9780143058144-M.jpg" },
    { id: 5, title: "Гаррі Поттер", author: "Дж. К. Роулінг", color: "#FFEAA7", image: "https://covers.openlibrary.org/b/isbn/9780747532699-M.jpg" },
    { id: 6, title: "Володар кілець", author: "Дж. Р. Р. Толкін", color: "#DDA0DD", image: "https://covers.openlibrary.org/b/isbn/9780544003415-M.jpg" }
  ];
  res.json(books);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
