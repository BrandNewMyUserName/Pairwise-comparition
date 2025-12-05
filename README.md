# Pairwise Comparison - Book Ranking

A web application for ranking books using drag and drop and visual comparison matrix.

## Features

- 📚 Display a list of books with beautiful design
- 🖱️ Drag and drop to change the order of books
- 📊 Visual comparison matrix with scores 1, 0, -1
- 🎨 Modern responsive design
- ⚡ Automatic matrix update when changing the order

## Installation and Setup

1. Install dependencies:
```bash
npm install
```

2. Run the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Drag and drop books**: Click and drag any book to change its position in the list
2. **Comparison matrix**: Click the "Show comparison matrix" button to display the matrix
3. **Reset order**: Use the "Reset order" button to randomly shuffle the books

## Matrix Logic

- **1** - book is better (located higher in the list)
- **0** - diagonal elements (book is compared with itself)
- **-1** - book is worse (located lower in the list)

## Technologies

- Node.js + Express
- SCSS for styling
- Vanilla JavaScript
- HTML5 Drag and Drop API

## Project Structure

```
├── public/
│   ├── css/
│   │   └── style.css (compiled from SCSS)
│   ├── js/
│   │   └── app.js
│   └── index.html
├── src/
│   └── styles/
│       └── main.scss
├── server.js
├── package.json
└── README.md
```
