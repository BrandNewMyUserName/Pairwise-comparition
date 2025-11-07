import sys
try:
    import PyPDF2
    with open('ЛАБОРАТОРНА РОБОТА 2.pdf', 'rb') as pdf_file:
        reader = PyPDF2.PdfReader(pdf_file)
        text = ''
        for page in reader.pages:
            text += page.extract_text() + '\n'
        print(text)
except ImportError:
    try:
        import pypdf
        with open('ЛАБОРАТОРНА РОБОТА 2.pdf', 'rb') as pdf_file:
            reader = pypdf.PdfReader(pdf_file)
            text = ''
            for page in reader.pages:
                text += page.extract_text() + '\n'
            print(text)
    except ImportError:
        print("Потрібно встановити PyPDF2 або pypdf")
        sys.exit(1)

