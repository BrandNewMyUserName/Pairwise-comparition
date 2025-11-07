class ExpertsRankingApp {
  constructor() {
    this.experts = [];
    this.books = [];
    this.currentExpert = null;
    this.expertRankings = {}; // { expertId: { rankings: [], deletedBooks: [] } }
    
    this.init();
  }

  async init() {
    await this.loadBooks();
    await this.loadExperts();
    this.setupEventListeners();
    this.renderExperts();
    await this.loadExpertRankings();
    this.renderRankingsMatrix();
    this.checkConflicts();
  }

  async loadBooks() {
    try {
      const response = await fetch('/api/books');
      this.books = await response.json();
    } catch (error) {
      console.error('Помилка завантаження книг:', error);
    }
  }

  async loadExperts() {
    try {
      const response = await fetch('/api/experts');
      this.experts = await response.json();
    } catch (error) {
      console.error('Помилка завантаження експертів:', error);
    }
  }

  async loadExpertRankings() {
    for (const expert of this.experts) {
      try {
        const response = await fetch(`/api/experts/${expert.id}/ranking`);
        const data = await response.json();
        this.expertRankings[expert.id] = {
          rankings: data.rankings || [],
          deletedBooks: data.deletedBooks || []
        };
      } catch (error) {
        console.error(`Помилка завантаження ранжування експерта ${expert.id}:`, error);
        this.expertRankings[expert.id] = {
          rankings: [],
          deletedBooks: []
        };
      }
    }
  }

  setupEventListeners() {
    // Додавання експерта
    document.getElementById('addExpertBtn').addEventListener('click', () => {
      document.getElementById('addExpertModal').style.display = 'block';
    });

    document.getElementById('addExpertForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('expertName').value;
      await this.addExpert(name);
      document.getElementById('addExpertModal').style.display = 'none';
      document.getElementById('addExpertForm').reset();
    });

    document.getElementById('cancelAddExpert').addEventListener('click', () => {
      document.getElementById('addExpertModal').style.display = 'none';
    });

    // Закриття модальних вікон
    document.querySelectorAll('.close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
      });
    });

    // Оновлення матриці
    document.getElementById('refreshMatrixBtn').addEventListener('click', () => {
      this.renderRankingsMatrix();
      this.checkConflicts();
    });

    // Експорт матриці
    document.getElementById('exportMatrixBtn').addEventListener('click', async () => {
      await this.exportMatrix();
    });

    // Обчислення компромісних ранжувань
    document.querySelectorAll('[data-method]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const method = e.target.dataset.method;
        await this.computeCompromiseRanking(method);
      });
    });
  }

  async addExpert(name) {
    try {
      const response = await fetch('/api/experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const expert = await response.json();
      this.experts.push(expert);
      this.expertRankings[expert.id] = {
        rankings: [],
        deletedBooks: []
      };
      this.renderExperts();
    } catch (error) {
      console.error('Помилка додавання експерта:', error);
      alert('Помилка додавання експерта');
    }
  }

  renderExperts() {
    const container = document.getElementById('expertsList');
    container.innerHTML = '';

    this.experts.forEach(expert => {
      const card = document.createElement('div');
      card.className = 'expert-card';
      
      const rankings = this.expertRankings[expert.id]?.rankings || [];
      const deletedBooks = this.expertRankings[expert.id]?.deletedBooks || [];
      const rankedCount = rankings.length;
      const deletedCount = deletedBooks.length;

      card.innerHTML = `
        <h3>${expert.name}</h3>
        <div class="expert-info">
          <p>Ранжовано об'єктів: ${rankedCount}</p>
          <p>Видалено об'єктів: ${deletedCount}</p>
          ${expert.createdAt ? `<p>Створено: ${new Date(expert.createdAt).toLocaleDateString('uk-UA')}</p>` : ''}
        </div>
        <div class="expert-actions">
          <button class="btn btn-primary" onclick="expertsApp.openExpertRanking(${expert.id})">
            ${rankedCount > 0 ? 'Редагувати ранжування' : 'Створити ранжування'}
          </button>
        </div>
      `;
      
      container.appendChild(card);
    });
  }

  async openExpertRanking(expertId) {
    const expert = this.experts.find(e => e.id === expertId);
    if (!expert) return;

    this.currentExpert = expert;
    document.getElementById('expertRankingTitle').textContent = `Ранжування: ${expert.name}`;
    
    const container = document.getElementById('expertRankingContainer');
    container.innerHTML = '';

    // Створюємо контейнер для книг з drag and drop
    const booksContainer = document.createElement('div');
    booksContainer.className = 'books-container';
    booksContainer.style.maxHeight = '500px';
    booksContainer.style.overflowY = 'auto';
    booksContainer.style.marginBottom = '20px';

    // Отримуємо поточне ранжування
    const currentRankings = this.expertRankings[expertId]?.rankings || [];
    const deletedBooks = this.expertRankings[expertId]?.deletedBooks || [];

    // Сортуємо книги за рангами
    const sortedBooks = [...this.books].sort((a, b) => {
      const rankA = currentRankings.find(r => r.bookId === a.id)?.rank || 999;
      const rankB = currentRankings.find(r => r.bookId === b.id)?.rank || 999;
      return rankA - rankB;
    });

    // Додаємо книги, які не ранжовані
    this.books.forEach(book => {
      if (!currentRankings.find(r => r.bookId === book.id) && !deletedBooks.includes(book.id)) {
        sortedBooks.push(book);
      }
    });

    sortedBooks.forEach((book, index) => {
      const isDeleted = deletedBooks.includes(book.id);
      const ranking = currentRankings.find(r => r.bookId === book.id);
      const rank = ranking ? ranking.rank : index + 1;

      const bookElement = document.createElement('div');
      bookElement.className = 'book';
      bookElement.dataset.bookId = book.id;
      bookElement.draggable = !isDeleted;
      bookElement.style.opacity = isDeleted ? '0.5' : '1';
      bookElement.style.borderLeft = `5px solid ${book.color}`;
      bookElement.style.padding = '12px';
      bookElement.style.marginBottom = '8px';
      bookElement.style.background = 'white';
      bookElement.style.borderRadius = '4px';
      bookElement.style.cursor = isDeleted ? 'not-allowed' : 'move';
      bookElement.style.display = 'flex';
      bookElement.style.alignItems = 'center';
      bookElement.style.gap = '15px';

      bookElement.innerHTML = `
        <div style="font-weight: bold; min-width: 30px;">${rank}</div>
        <div style="flex: 1;">
          <h4 style="margin: 0; font-size: 1.1rem;">${book.title}</h4>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9rem;">${book.author}</p>
        </div>
        <button class="btn btn-danger" onclick="expertsApp.toggleDeleteBook(${expertId}, ${book.id})" style="padding: 5px 10px; font-size: 0.8rem;">
          ${isDeleted ? 'Відновити' : 'Видалити'}
        </button>
      `;

      if (!isDeleted) {
        this.addDragListeners(bookElement, expertId);
      }

      booksContainer.appendChild(bookElement);
    });

    container.appendChild(booksContainer);
    document.getElementById('expertRankingModal').style.display = 'block';
  }

  addDragListeners(element, expertId) {
    element.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      element.classList.add('dragging');
    });

    element.addEventListener('dragend', (e) => {
      element.classList.remove('dragging');
    });

    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = this.getDragAfterElement(element.parentElement, e.clientY);
      const dragging = document.querySelector('.dragging');
      
      if (afterElement == null) {
        element.parentElement.appendChild(dragging);
      } else {
        element.parentElement.insertBefore(dragging, afterElement);
      }
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      this.updateExpertRankingOrder(expertId);
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

  updateExpertRankingOrder(expertId) {
    const container = document.getElementById('expertRankingContainer').querySelector('.books-container');
    const bookElements = container.querySelectorAll('.book:not([style*="opacity: 0.5"])');
    
    const rankings = [];
    bookElements.forEach((element, index) => {
      const bookId = parseInt(element.dataset.bookId);
      rankings.push({
        bookId: bookId,
        rank: index + 1
      });
    });

    this.expertRankings[expertId].rankings = rankings;
  }

  toggleDeleteBook(expertId, bookId) {
    if (!this.expertRankings[expertId]) {
      this.expertRankings[expertId] = { rankings: [], deletedBooks: [] };
    }

    const deletedBooks = this.expertRankings[expertId].deletedBooks || [];
    const index = deletedBooks.indexOf(bookId);
    
    if (index > -1) {
      deletedBooks.splice(index, 1);
    } else {
      deletedBooks.push(bookId);
      // Видаляємо з ранжування
      this.expertRankings[expertId].rankings = this.expertRankings[expertId].rankings.filter(r => r.bookId !== bookId);
    }

    this.expertRankings[expertId].deletedBooks = deletedBooks;
    this.openExpertRanking(expertId);
  }

  async saveExpertRanking() {
    if (!this.currentExpert) return;

    const expertId = this.currentExpert.id;
    this.updateExpertRankingOrder(expertId);

    try {
      const response = await fetch(`/api/experts/${expertId}/ranking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.expertRankings[expertId])
      });

      if (response.ok) {
        alert('Ранжування збережено успішно!');
        document.getElementById('expertRankingModal').style.display = 'none';
        this.renderExperts();
        this.renderRankingsMatrix();
        this.checkConflicts();
      }
    } catch (error) {
      console.error('Помилка збереження ранжування:', error);
      alert('Помилка збереження ранжування');
    }
  }

  async renderRankingsMatrix() {
    try {
      const response = await fetch('/api/experts-rankings-matrix');
      const data = await response.json();

      const container = document.getElementById('rankingsMatrix');
      container.innerHTML = '';

      if (data.experts.length === 0) {
        container.innerHTML = '<p>Немає експертів. Додайте експертів для відображення матриці.</p>';
        return;
      }

      const table = document.createElement('table');
      table.className = 'rankings-matrix-table';

      // Заголовок
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.appendChild(document.createElement('th')).textContent = 'Початковий номер';
      headerRow.appendChild(document.createElement('th')).textContent = 'Назва об\'єкта';
      data.experts.forEach(expert => {
        headerRow.appendChild(document.createElement('th')).textContent = expert.name;
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Тіло таблиці
      const tbody = document.createElement('tbody');
      data.matrix.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.appendChild(document.createElement('td')).textContent = index + 1;
        tr.appendChild(document.createElement('td')).textContent = row.bookTitle;
        
        row.expertRankings.forEach(expertRanking => {
          const td = document.createElement('td');
          if (expertRanking.isDeleted) {
            td.textContent = 'ВИДАЛЕНО';
            td.className = 'deleted';
          } else {
            td.textContent = expertRanking.rank || '-';
          }
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      container.appendChild(table);
    } catch (error) {
      console.error('Помилка відображення матриці:', error);
    }
  }

  async checkConflicts() {
    try {
      const response = await fetch('/api/experts-rankings-matrix');
      const data = await response.json();

      const conflicts = [];
      
      data.matrix.forEach(row => {
        const deletedBy = [];
        const rankedBy = [];
        
        row.expertRankings.forEach(expertRanking => {
          if (expertRanking.isDeleted) {
            deletedBy.push(expertRanking.expertName);
          } else if (expertRanking.rank !== null) {
            rankedBy.push(expertRanking.expertName);
          }
        });

        if (deletedBy.length > 0 && rankedBy.length > 0) {
          conflicts.push({
            bookTitle: row.bookTitle,
            deletedBy,
            rankedBy
          });
        }
      });

      const conflictsSection = document.getElementById('conflictsSection');
      const conflictsList = document.getElementById('conflictsList');

      if (conflicts.length > 0) {
        conflictsSection.style.display = 'block';
        conflictsList.innerHTML = '';

        conflicts.forEach(conflict => {
          const conflictItem = document.createElement('div');
          conflictItem.className = 'conflict-item';
          conflictItem.innerHTML = `
            <strong>${conflict.bookTitle}</strong><br>
            Видалено експертами: ${conflict.deletedBy.join(', ')}<br>
            Ранжовано експертами: ${conflict.rankedBy.join(', ')}
          `;
          conflictsList.appendChild(conflictItem);
        });
      } else {
        conflictsSection.style.display = 'none';
      }
    } catch (error) {
      console.error('Помилка перевірки суперечностей:', error);
    }
  }

  async computeCompromiseRanking(method) {
    try {
      const response = await fetch('/api/compute-compromise-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method })
      });

      const result = await response.json();

      if (result.error) {
        alert(result.error);
        return;
      }

      const container = document.getElementById('compromiseResults');
      container.innerHTML = '';

      const methodNames = {
        'kemeny-snell': 'Медіана Кемені-Снела',
        'cook-seiford': 'Медіана Кука-Сейфорда',
        'minimax': 'Мінімаксна медіана',
        'gv-median': 'ГВ-медіана'
      };

      const resultDiv = document.createElement('div');
      resultDiv.innerHTML = `
        <h3>${methodNames[method] || method}</h3>
        <p><strong>Сумарна відстань:</strong> ${result.totalDistance.toFixed(2)}</p>
        <p><strong>Максимальна відстань:</strong> ${result.maxDistance.toFixed(2)}</p>
        <p><strong>Середня відстань:</strong> ${result.avgDistance.toFixed(2)}</p>
        
        <h4 style="margin-top: 20px;">Оптимальне ранжування:</h4>
        <ol>
          ${result.optimalRanking.sort((a, b) => a.rank - b.rank).map(item => 
            `<li><strong>${item.bookTitle}</strong> (ранг: ${item.rank})</li>`
          ).join('')}
        </ol>

        <h4 style="margin-top: 20px;">Коефіцієнти компетентності експертів:</h4>
        <table class="competence-table">
          <thead>
            <tr>
              <th>Експерт</th>
              <th>Відстань</th>
              <th>Коефіцієнт компетентності</th>
            </tr>
          </thead>
          <tbody>
            ${result.competenceCoefficients.map(c => `
              <tr>
                <td>${c.expertName}</td>
                <td>${c.distance.toFixed(2)}</td>
                <td>${(c.competence * 100).toFixed(2)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.appendChild(resultDiv);
    } catch (error) {
      console.error('Помилка обчислення компромісного ранжування:', error);
      alert('Помилка обчислення компромісного ранжування');
    }
  }

  async exportMatrix() {
    try {
      const response = await fetch('/api/export-experts-matrix', {
        method: 'POST'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'experts_rankings_matrix.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Помилка експорту:', error);
      alert('Помилка експорту матриці');
    }
  }
}

// Ініціалізація додатку
let expertsApp;
document.addEventListener('DOMContentLoaded', () => {
  expertsApp = new ExpertsRankingApp();
  
  // Додаємо обробники для збереження ранжування
  document.getElementById('saveExpertRanking').addEventListener('click', () => {
    expertsApp.saveExpertRanking();
  });

  document.getElementById('cancelExpertRanking').addEventListener('click', () => {
    document.getElementById('expertRankingModal').style.display = 'none';
  });
});

