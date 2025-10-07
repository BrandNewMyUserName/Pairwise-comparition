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
    { id: 1, title: "Война и мир", author: "Лев Толстой", color: "#FF6B6B" },
    { id: 2, title: "1984", author: "Джордж Оруэлл", color: "#4ECDC4" },
    { id: 3, title: "Мастер и Маргарита", author: "Михаил Булгаков", color: "#45B7D1" },
    { id: 4, title: "Преступление и наказание", author: "Фёдор Достоевский", color: "#96CEB4" },
    { id: 5, title: "Гарри Поттер", author: "Дж. К. Роулинг", color: "#FFEAA7" },
    { id: 6, title: "Властелин колец", author: "Дж. Р. Р. Толкин", color: "#DDA0DD" }
  ];
  res.json(books);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
