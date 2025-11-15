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
    // Додавання книги
    document.getElementById('addBookBtn').addEventListener('click', () => {
      document.getElementById('addBookModal').style.display = 'block';
    });

    document.getElementById('addBookForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addBook();
      document.getElementById('addBookModal').style.display = 'none';
      document.getElementById('addBookForm').reset();
    });

    document.getElementById('cancelAddBook').addEventListener('click', () => {
      document.getElementById('addBookModal').style.display = 'none';
    });

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
        const modal = e.target.closest('.modal');
        if (modal) {
          modal.style.display = 'none';
          // Очищаємо форму додавання книги при закритті
          if (modal.id === 'addBookModal') {
            document.getElementById('addBookForm').reset();
          }
        }
      });
    });
    
    // Закриття модальних вікон при кліку поза ними
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
        if (e.target.id === 'addBookModal') {
          document.getElementById('addBookForm').reset();
        }
      }
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
        e.preventDefault();
        e.stopPropagation();
        
        const method = e.target.dataset.method || e.target.closest('[data-method]')?.dataset.method;
        
        if (!method) {
          console.error('Метод не знайдено');
          return;
        }
        
        console.log('Обчислення компромісного ранжування методом:', method);
        await this.computeCompromiseRanking(method);
      });
    });

    // Оновлення всіх обчислень
    document.getElementById('refreshCompromiseBtn').addEventListener('click', async () => {
      await this.refreshAllComputations();
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

    // Оновлюємо список книг перед відкриттям ранжування
    await this.loadBooks();

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
        // Перевіряємо, чи книга вже не додана
        if (!sortedBooks.find(b => b.id === book.id)) {
          sortedBooks.push(book);
        }
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
      data.matrix.forEach((row) => {
        const tr = document.createElement('tr');
        // Використовуємо originalNumber якщо він є, інакше знаходимо індекс
        const originalNum = row.originalNumber !== undefined ? row.originalNumber : (data.matrix.findIndex(r => r.bookId === row.bookId) + 1);
        tr.appendChild(document.createElement('td')).textContent = originalNum;
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
    const container = document.getElementById('compromiseResults');
    
    // Показуємо індикатор завантаження
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;"><p>⏳ Обчислення...</p></div>';
    
    // Блокуємо кнопки під час обчислення
    const buttons = document.querySelectorAll('[data-method]');
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
    });
    
    try {
      const response = await fetch('/api/compute-compromise-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Логування для діагностики
      console.log('=== РЕЗУЛЬТАТ ОБЧИСЛЕННЯ ===');
      console.log('competenceCoefficients:', result.competenceCoefficients);
      if (result.competenceCoefficients) {
        result.competenceCoefficients.forEach((c, idx) => {
          console.log(`Експерт ${idx + 1}:`, {
            expertName: c.expertName,
            distance: c.distance,
            ratio: c.ratio,
            normalized: c.normalized,
            ideal: c.ideal
          });
        });
      }
      console.log('============================');

      if (result.error) {
        container.innerHTML = `<div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; color: #721c24;">
          <strong>Помилка:</strong> ${result.error}
        </div>`;
        return;
      }

      // Очищаємо контейнер перед додаванням нового результату
      container.innerHTML = '';

      const methodNames = {
        'kemeny-snell': 'Медіана Кемені-Снела',
        'cook-seiford': 'Медіана Кука-Сейфорда',
        'minimax': 'Мінімаксна медіана',
        'gv-median': 'ГВ-медіана'
      };

      const resultDiv = document.createElement('div');
      resultDiv.style.background = '#f8f9fa';
      resultDiv.style.padding = '20px';
      resultDiv.style.borderRadius = '8px';
      resultDiv.style.marginBottom = '20px';
      resultDiv.style.border = '1px solid #e5e5e5';
      
      let warningHtml = '';
      if (result.warning) {
        warningHtml = `<div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px; margin-bottom: 15px; color: #856404;">
          ⚠️ ${result.warning}
        </div>`;
      }
      
      let bestCountHtml = '';
      if (result.bestPermutationsCount > 1) {
        bestCountHtml = `<div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; padding: 10px; margin-bottom: 15px; color: #0c5460;">
          ℹ️ Знайдено ${result.bestPermutationsCount} оптимальних перестановок з однаковим значенням критерію.
        </div>`;
      }
      
      // Додаємо інформацію про використану метрику та критерій
      let debugInfo = '';
      if (result.debug) {
        debugInfo = `<div style="background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 4px; padding: 10px; margin-bottom: 15px; font-size: 0.9rem; color: #004085;">
          <strong>Використано:</strong> Метрика ${result.debug.metric}, Критерій ${result.debug.criterion}, Найкращий score: ${result.debug.bestScore}
        </div>`;
      }
      
      resultDiv.innerHTML = `
        <h3 style="margin-top: 0;">${result.methodName || methodNames[method] || method}</h3>
        ${debugInfo}
        ${warningHtml}
        ${bestCountHtml}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
          <div style="background: white; padding: 15px; border-radius: 4px;">
            <strong>Сумарна відстань:</strong><br>
            <span style="font-size: 1.5rem; color: #0078d4;">${result.totalDistance.toFixed(2)}</span>
          </div>
          <div style="background: white; padding: 15px; border-radius: 4px;">
            <strong>Максимальна відстань:</strong><br>
            <span style="font-size: 1.5rem; color: #d13438;">${result.maxDistance.toFixed(2)}</span>
          </div>
          <div style="background: white; padding: 15px; border-radius: 4px;">
            <strong>Середня відстань:</strong><br>
            <span style="font-size: 1.5rem; color: #107c10;">${result.avgDistance.toFixed(2)}</span>
          </div>
        </div>
        
        <h4 style="margin-top: 20px;">Оптимальне ранжування:</h4>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 10px; text-align: left; border: 1px solid #e5e5e5;">Початковий номер</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #e5e5e5;">Назва об'єкта</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #e5e5e5;">Ранг у оптимальному ранжуванні</th>
            </tr>
          </thead>
          <tbody>
            ${result.optimalRanking.sort((a, b) => a.rank - b.rank).map(item => 
              `<tr>
                <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center; font-weight: bold;">${item.originalNumber || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #e5e5e5;"><strong>${item.bookTitle}</strong></td>
                <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center; font-weight: bold;">${item.rank}</td>
              </tr>`
            ).join('')}
          </tbody>
        </table>

        <h4 style="margin-top: 20px;">Коефіцієнти компетентності експертів:</h4>
        ${result.maxDistanceAmongExperts !== undefined ? `
          <div style="background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 4px; padding: 10px; margin-bottom: 15px; font-size: 0.9rem; color: #004085;">
            <strong>Найбільша відстань серед експертів:</strong> ${result.maxDistanceAmongExperts.toFixed(2)}
          </div>
        ` : ''}
        <div style="overflow-x: auto;">
          <table class="competence-table" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border: 1px solid #e5e5e5;">Експерти</th>
                <th style="padding: 10px; text-align: center; border: 1px solid #e5e5e5;">Відстані експертів</th>
                <th style="padding: 10px; text-align: center; border: 1px solid #e5e5e5;">Співвідношення рангів</th>
                <th style="padding: 10px; text-align: center; border: 1px solid #e5e5e5;">Нормовані коефіцієнти</th>
                <th style="padding: 10px; text-align: center; border: 1px solid #e5e5e5;">Нормовані коефіцієнти, %</th>
                <th style="padding: 10px; text-align: center; border: 1px solid #e5e5e5; color: #d13438;">Ідеальні коефіцієнти</th>
                <th style="padding: 10px; text-align: center; border: 1px solid #e5e5e5; color: #d13438;">Ідеальні коефіцієнти, %</th>
              </tr>
            </thead>
            <tbody>
              ${result.competenceCoefficients.map((c, idx) => {
                // Перевіряємо, чи значення існують (навіть якщо вони 0)
                const ratio = (c.ratio !== undefined && !isNaN(c.ratio)) ? c.ratio.toFixed(2) : 'N/A';
                const normalized = (c.normalized !== undefined && !isNaN(c.normalized)) ? c.normalized.toFixed(2) : 'N/A';
                const normalizedPercent = (c.normalized !== undefined && !isNaN(c.normalized)) ? (c.normalized * 100).toFixed(0) + '%' : 'N/A';
                const ideal = (c.ideal !== undefined && !isNaN(c.ideal)) ? c.ideal.toFixed(2) : 'N/A';
                const idealPercent = (c.ideal !== undefined && !isNaN(c.ideal)) ? (c.ideal * 100).toFixed(0) + '%' : 'N/A';
                
                return `
                <tr>
                  <td style="padding: 10px; border: 1px solid #e5e5e5; font-weight: bold;">${idx + 1}<br><span style="font-size: 0.85em; color: #666; font-weight: normal;">${c.expertName}</span></td>
                  <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center;">${c.distance !== undefined ? c.distance.toFixed(0) : 'N/A'}</td>
                  <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center;">${ratio}</td>
                  <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center; font-weight: bold;">${normalized}</td>
                  <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center;">${normalizedPercent}</td>
                  <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center; color: #d13438; font-weight: bold;">${ideal}</td>
                  <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center; color: #d13438;">${idealPercent}</td>
                </tr>
                `;
              }).join('')}
              ${(() => {
                // Обчислюємо максимум з normalized значень один раз
                const normalizedValues = result.competenceCoefficients
                  .map(c => c.normalized)
                  .filter(val => val !== undefined && !isNaN(val) && isFinite(val))
                  .map(val => Number(val));
                const maxNormalized = normalizedValues.length > 0 ? Math.max(...normalizedValues) : 0;
                const maxNormalizedFormatted = maxNormalized.toFixed(2);
                const maxNormalizedPercent = (maxNormalized * 100).toFixed(0) + '%';
                
                return `
              <tr style="background: #f8f9fa; font-weight: bold;">
                <td style="padding: 10px; border: 1px solid #e5e5e5;"></td>
                <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center;">${result.maxDistanceAmongExperts !== undefined ? result.maxDistanceAmongExperts.toFixed(0) : 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center;">${result.competenceCoefficients.reduce((sum, c) => sum + (c.ratio || 0), 0).toFixed(2)}</td>
                <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center; color: #d13438;">${maxNormalizedFormatted}</td>
                <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center;">${maxNormalizedPercent}</td>
                <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center; color: #d13438;"></td>
                <td style="padding: 10px; border: 1px solid #e5e5e5; text-align: center; color: #d13438;"></td>
              </tr>
                `;
              })()}
            </tbody>
          </table>
        </div>
      `;

      container.appendChild(resultDiv);
      
      // Прокручуємо до результатів
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
    } catch (error) {
      console.error('Помилка обчислення компромісного ранжування:', error);
      container.innerHTML = `<div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; color: #721c24;">
        <strong>Помилка:</strong> ${error.message || 'Помилка обчислення компромісного ранжування'}
      </div>`;
    } finally {
      // Розблоковуємо кнопки після обчислення
      buttons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      });
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

  async refreshAllComputations() {
    // Оновлюємо дані
    await this.loadBooks();
    await this.loadExperts();
    await this.loadExpertRankings();
    this.renderExperts();
    this.renderRankingsMatrix();
    this.checkConflicts();
    
    // Очищаємо результати компромісних ранжувань
    document.getElementById('compromiseResults').innerHTML = '<p style="color: #666;">Натисніть на кнопку методу для обчислення компромісного ранжування.</p>';
    
    alert('Дані оновлено! Тепер можна обчислити компромісні ранжування.');
  }

  async addBook() {
    try {
      const title = document.getElementById('bookTitle').value;
      const author = document.getElementById('bookAuthor').value;
      const color = document.getElementById('bookColor').value;
      const image = document.getElementById('bookImage').value;

      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, color, image })
      });

      if (response.ok) {
        const newBook = await response.json();
        alert(`Книга "${newBook.title}" успішно додана!`);
        
        // Оновлюємо список книг
        await this.loadBooks();
        
        // Оновлюємо матрицю та інші компоненти
        this.renderRankingsMatrix();
        this.checkConflicts();
        
        // Очищаємо результати компромісних ранжувань, оскільки список книг змінився
        document.getElementById('compromiseResults').innerHTML = '<p style="color: #666;">Натисніть на кнопку методу для обчислення компромісного ранжування.</p>';
      } else {
        const error = await response.json();
        alert(`Помилка: ${error.error || 'Не вдалося додати книгу'}`);
      }
    } catch (error) {
      console.error('Помилка додавання книги:', error);
      alert('Помилка додавання книги');
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

