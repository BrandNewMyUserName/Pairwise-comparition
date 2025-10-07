class BookRankingApp {
  constructor() {
    this.books = [];
    this.originalBooks = []; // Сохраняем оригинальный порядок для матрицы
    this.booksContainer = document.getElementById('booksContainer');
    this.matrixContainer = document.getElementById('matrixContainer');
    this.toggleMatrixBtn = document.getElementById('toggleMatrix');
    this.resetOrderBtn = document.getElementById('resetOrder');
    this.addBookBtn = document.getElementById('addBook');
    this.comparisonMatrix = document.getElementById('comparisonMatrix');
    this.addBookModal = document.getElementById('addBookModal');
    this.addBookForm = document.getElementById('addBookForm');
    
    this.isMatrixVisible = false;
    this.draggedElement = null;
    this.nextBookId = 7; // Для новых книг
    
    this.init();
  }
  
  async init() {
    await this.loadBooks();
    this.renderBooks();
    this.setupEventListeners();
    this.updateMatrix();
  }
  
  async loadBooks() {
    try {
      const response = await fetch('/api/books');
      this.books = await response.json();
    } catch (error) {
      console.error('Помилка завантаження книг:', error);
      // Fallback дані
      this.books = [
        { 
          id: 1, 
          title: "Війна і мир", 
          author: "Лев Толстой", 
          color: "#FF6B6B", 
          image: "https://covers.openlibrary.org/b/isbn/9780140447934-M.jpg" 
        },
        { 
          id: 2, 
          title: "1984", 
          author: "Джордж Оруелл", 
          color: "#4ECDC4", 
          image: "https://covers.openlibrary.org/b/isbn/9780451524935-M.jpg" 
        },
        { 
          id: 3, 
          title: "Майстер і Маргарита", 
          author: "Михайло Булгаков", 
          color: "#45B7D1", 
          image: "https://covers.openlibrary.org/b/isbn/9780141180144-M.jpg" 
        },
        { 
          id: 4, 
          title: "Злочин і кара", 
          author: "Федір Достоєвський", 
          color: "#96CEB4", 
          image: "https://covers.openlibrary.org/b/isbn/9780143058144-M.jpg" 
        },
        { 
          id: 5, 
          title: "Гаррі Поттер", 
          author: "Дж. К. Роулінг", 
          color: "#FFEAA7", 
          image: "https://covers.openlibrary.org/b/isbn/9780747532699-M.jpg" 
        },
        { 
          id: 6, 
          title: "Володар кілець", 
          author: "Дж. Р. Р. Толкін", 
          color: "#DDA0DD", 
          image: "https://covers.openlibrary.org/b/isbn/9780544003415-M.jpg" 
        }
      ];
    }
    // Зберігаємо оригінальний порядок для матриці
    this.originalBooks = [...this.books];
  }
  
  renderBooks() {
    this.booksContainer.innerHTML = '';
    
    this.books.forEach((book, index) => {
      const bookElement = this.createBookElement(book, index + 1);
      this.booksContainer.appendChild(bookElement);
    });
    
    // Адаптируем размеры книг в зависимости от их количества
    this.adaptBookSizes();
  }
  
  adaptBookSizes() {
    const bookCount = this.books.length;
    const containerHeight = this.booksContainer.clientHeight;
    const availableHeight = containerHeight - 32; // учитываем padding
    const gapHeight = (bookCount - 1) * 2; // gap между книгами
    const bookHeight = Math.max(60, Math.min(120, (availableHeight - gapHeight) / bookCount));
    
    // Применяем высоту к книгам
    const books = this.booksContainer.querySelectorAll('.book');
    books.forEach(book => {
      book.style.minHeight = `${bookHeight}px`;
    });
    
    console.log(`Адаптировано ${bookCount} книг, высота: ${bookHeight}px`);
  }
  
  createBookElement(book, rank) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book';
    bookDiv.draggable = true;
    bookDiv.dataset.bookId = book.id;
    bookDiv.dataset.rank = rank;
    
    // Знаходимо оригінальну позицію книги
    const originalIndex = this.originalBooks.findIndex(b => b.id === book.id);
    const originalRank = originalIndex + 1;
    
    // Створюємо зображення з fallback
    const coverElement = this.createBookCover(book);
    
    bookDiv.innerHTML = `
      ${coverElement.outerHTML}
      <div class="book-info">
        <h3>${book.title}</h3>
        <p>${book.author}</p>
      </div>
      <div class="book-original-rank" title="Оригінальна позиція: ${originalRank}">${originalRank}</div>
      <div class="book-delete" onclick="app.deleteBook(${book.id})">×</div>
    `;
    
    // Додаємо обробники drag and drop
    this.addDragListeners(bookDiv);
    
    return bookDiv;
  }
  
  createBookCover(book) {
    const coverDiv = document.createElement('div');
    coverDiv.className = 'book-cover';
    coverDiv.style.backgroundColor = book.color;
    
    // Спробуємо завантажити зображення
    if (book.image) {
      const img = document.createElement('img');
      img.src = book.image;
      img.alt = book.title;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '4px';
      img.loading = 'lazy'; // Ленивая загрузка для производительности
      
      img.onload = () => {
        console.log(`Зображення завантажено: ${book.title}`);
      };
      
      img.onerror = () => {
        console.log(`Помилка завантаження зображення для: ${book.title}`);
        // Якщо зображення не завантажилося, показуємо першу букву
        coverDiv.innerHTML = book.title.charAt(0);
        coverDiv.style.display = 'flex';
        coverDiv.style.alignItems = 'center';
        coverDiv.style.justifyContent = 'center';
        coverDiv.style.color = 'white';
        coverDiv.style.fontWeight = 'bold';
        coverDiv.style.fontSize = '0.7rem';
      };
      
      coverDiv.appendChild(img);
    } else {
      // Якщо немає зображення, показуємо першу букву
      coverDiv.textContent = book.title.charAt(0);
      coverDiv.style.display = 'flex';
      coverDiv.style.alignItems = 'center';
      coverDiv.style.justifyContent = 'center';
      coverDiv.style.color = 'white';
      coverDiv.style.fontWeight = 'bold';
      coverDiv.style.fontSize = '0.7rem';
    }
    
    return coverDiv;
  }
  
  addDragListeners(element) {
    element.addEventListener('dragstart', (e) => {
      this.draggedElement = element;
      element.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', element.outerHTML);
    });
    
    element.addEventListener('dragend', (e) => {
      element.classList.remove('dragging');
      this.draggedElement = null;
      
      // Убираем все drag-over классы
      document.querySelectorAll('.book').forEach(book => {
        book.classList.remove('drag-over', 'drag-above', 'drag-below');
      });
    });
    
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (this.draggedElement === element) return;
      
      const afterElement = this.getDragAfterElement(this.booksContainer, e.clientY);
      const dragging = document.querySelector('.dragging');
      
      if (!dragging) return;
      
      // Убираем предыдущие индикаторы
      document.querySelectorAll('.book').forEach(book => {
        book.classList.remove('drag-above', 'drag-below');
      });
      
      if (afterElement == null) {
        // Перемещаем в конец
        this.booksContainer.appendChild(dragging);
        const lastBook = this.booksContainer.lastElementChild;
        if (lastBook && lastBook !== dragging) {
          lastBook.classList.add('drag-above');
        }
      } else {
        // Перемещаем перед элементом
        this.booksContainer.insertBefore(dragging, afterElement);
        afterElement.classList.add('drag-below');
      }
    });
    
    element.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (this.draggedElement !== element) {
        element.classList.add('drag-over');
      }
    });
    
    element.addEventListener('dragleave', (e) => {
      if (!element.contains(e.relatedTarget)) {
        element.classList.remove('drag-over', 'drag-above', 'drag-below');
      }
    });
    
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      this.updateBooksOrder();
      this.updateMatrix();
    });
  }
  
  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.book:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
  
  updateBooksOrder() {
    const bookElements = this.booksContainer.querySelectorAll('.book');
    const newOrder = [];
    
    bookElements.forEach((element, index) => {
      const bookId = parseInt(element.dataset.bookId);
      const book = this.books.find(b => b.id === bookId);
      if (book) {
        newOrder.push(book);
        element.dataset.rank = index + 1;
      }
    });
    
    // Обновляем только если порядок действительно изменился
    const orderChanged = JSON.stringify(this.books.map(b => b.id)) !== JSON.stringify(newOrder.map(b => b.id));
    
    if (orderChanged) {
      this.books = newOrder;
      console.log('Порядок книг обновлен:', this.books.map(b => b.title));
    }
  }
  
  updateMatrix() {
    if (!this.isMatrixVisible) return;
    
    // Очищаємо таблицю та інформаційний блок
    this.comparisonMatrix.innerHTML = '';
    const existingInfo = this.matrixContainer.querySelector('.matrix-info');
    if (existingInfo) {
      existingInfo.remove();
    }
    
    if (this.originalBooks.length === 0) return;
    
    // Створюємо заголовок з оригінальним порядком книг
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th></th>'; // Пуста клітинка в куті
    
    this.originalBooks.forEach(book => {
      const th = document.createElement('th');
      th.textContent = book.title.substring(0, 6) + (book.title.length > 6 ? '...' : '');
      th.title = book.title; // Повна назва в tooltip
      th.style.fontSize = '10px';
      th.style.padding = '6px 2px';
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    this.comparisonMatrix.appendChild(thead);
    
    // Створюємо тіло таблиці з оригінальним порядком
    const tbody = document.createElement('tbody');
    
    this.originalBooks.forEach((book, rowIndex) => {
      const row = document.createElement('tr');
      
      // Перша клітинка - назва книги
      const firstCell = document.createElement('td');
      firstCell.textContent = book.title.substring(0, 6) + (book.title.length > 6 ? '...' : '');
      firstCell.title = book.title;
      firstCell.style.fontWeight = 'bold';
      firstCell.style.background = '#f8f9fa';
      firstCell.style.fontSize = '10px';
      firstCell.style.padding = '6px 2px';
      row.appendChild(firstCell);
      
      // Решта клітинок - значення порівняння
      this.originalBooks.forEach((otherBook, colIndex) => {
        const cell = document.createElement('td');
        cell.style.fontSize = '12px';
        cell.style.fontWeight = 'bold';
        cell.style.padding = '6px 2px';
        
        if (rowIndex === colIndex) {
          // Діагональні елементи
          cell.textContent = '0';
          cell.className = 'diagonal';
        } else {
          // Порівнюємо поточні позиції в ранжированому списку
          const currentBookRank = this.getCurrentRank(book.id);
          const otherBookRank = this.getCurrentRank(otherBook.id);
          
          if (currentBookRank < otherBookRank) {
            // Поточна книга краще (вище в списку)
            cell.textContent = '1';
            cell.className = 'better';
          } else {
            // Поточна книга гірше (нижче в списку)
            cell.textContent = '-1';
            cell.className = 'worse';
          }
        }
        
        row.appendChild(cell);
      });
      
      tbody.appendChild(row);
    });
    
    this.comparisonMatrix.appendChild(tbody);
    
    // Додаємо інформацію про поточний порядок
    this.addMatrixInfo();
  }
  
  addMatrixInfo() {
    // Створюємо інформаційний блок з поточним порядком
    const infoDiv = document.createElement('div');
    infoDiv.className = 'matrix-info';
    infoDiv.style.marginTop = '16px';
    infoDiv.style.padding = '12px';
    infoDiv.style.background = '#f8f9fa';
    infoDiv.style.borderRadius = '4px';
    infoDiv.style.fontSize = '14px';
    
    const currentOrder = this.books.map((book, index) => `${index + 1}. ${book.title}`).join(', ');
    infoDiv.innerHTML = `<strong>Поточний порядок:</strong> ${currentOrder}`;
    
    this.matrixContainer.appendChild(infoDiv);
  }
  
  getCurrentRank(bookId) {
    const bookIndex = this.books.findIndex(book => book.id === bookId);
    return bookIndex + 1; // Ранг починається з 1
  }
  
  setupEventListeners() {
    this.toggleMatrixBtn.addEventListener('click', () => {
      this.toggleMatrix();
    });
    
    this.resetOrderBtn.addEventListener('click', () => {
      this.resetOrder();
    });
    
    this.addBookBtn.addEventListener('click', () => {
      this.showAddBookModal();
    });
    
    this.addBookForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addNewBook();
    });
    
    // Закриття модального вікна
    document.querySelector('.close').addEventListener('click', () => {
      this.hideAddBookModal();
    });
    
    document.getElementById('cancelAdd').addEventListener('click', () => {
      this.hideAddBookModal();
    });
    
    // Закриття по кліку поза модальним вікном
    this.addBookModal.addEventListener('click', (e) => {
      if (e.target === this.addBookModal) {
        this.hideAddBookModal();
      }
    });
  }
  
  toggleMatrix() {
    this.isMatrixVisible = !this.isMatrixVisible;
    
    if (this.isMatrixVisible) {
      this.matrixContainer.style.display = 'block';
      this.toggleMatrixBtn.textContent = 'Сховати матрицю порівнянь';
      this.updateMatrix();
    } else {
      this.matrixContainer.style.display = 'none';
      this.toggleMatrixBtn.textContent = 'Показати матрицю порівнянь';
    }
  }
  
  resetOrder() {
    // Перемішуємо книги випадковим чином
    this.books = this.books.sort(() => Math.random() - 0.5);
    this.renderBooks();
    this.updateMatrix();
  }
  
  showAddBookModal() {
    this.addBookModal.style.display = 'flex';
    document.getElementById('bookTitle').focus();
  }
  
  hideAddBookModal() {
    this.addBookModal.style.display = 'none';
    this.addBookForm.reset();
  }
  
  addNewBook() {
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const color = document.getElementById('bookColor').value;
    const image = document.getElementById('bookImage').value.trim();
    
    if (!title || !author) {
      alert('Будь ласка, заповніть всі поля');
      return;
    }
    
    const newBook = {
      id: this.nextBookId++,
      title: title,
      author: author,
      color: color,
      image: image || null
    };
    
    // Додаємо книгу в кінець списку
    this.books.push(newBook);
    this.originalBooks.push(newBook);
    
    this.renderBooks();
    this.updateMatrix();
    this.hideAddBookModal();
    
    // Адаптируем размеры после добавления
    setTimeout(() => this.adaptBookSizes(), 100);
  }
  
  deleteBook(bookId) {
    if (confirm('Ви впевнені, що хочете видалити цю книгу?')) {
      // Видаляємо з обох списків
      this.books = this.books.filter(book => book.id !== bookId);
      this.originalBooks = this.originalBooks.filter(book => book.id !== bookId);
      
      this.renderBooks();
      this.updateMatrix();
      
      // Адаптируем размеры после удаления
      setTimeout(() => this.adaptBookSizes(), 100);
    }
  }
}

// Ініціалізація додатку при завантаженні сторінки
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new BookRankingApp();
});
