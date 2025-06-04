# WordPress Git Publisher 🚀

Automatyczne generowanie i publikowanie artykułów na WordPress na podstawie aktywności Git z wykorzystaniem AI (Ollama).

## ✨ Funkcje

- 📁 **Skanowanie repozytoriów Git** - Automatyczne wykrywanie projektów w strukturze `github/*/*`
- 🤖 **Generowanie artykułów AI** - Wykorzystanie Ollama z modelami Mistral 7B, Llama2, CodeLlama
- 📝 **Publikacja na WordPress** - Bezpośrednie publikowanie przez WordPress REST API
- 🎯 **Analiza commitów** - Szczegółowa analiza zmian w kodzie z danego dnia
- 📊 **Podgląd treści** - Możliwość przejrzenia artykułu przed publikacją
- 🔐 **Bezpieczna autoryzacja** - Wsparcie dla Application Passwords WordPress

## 🛠️ Wymagania

### Oprogramowanie
- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **Git** zainstalowany i skonfigurowany
- **Ollama** z wybranym modelem AI

### Usługi
- **WordPress** z włączonym REST API
- **Application Password** skonfigurowane w WordPress

## 📦 Instalacja

### 1. Klonowanie repozytorium
```bash
git clone https://github.com/your-username/wordpress-git-publisher.git
cd wordpress-git-publisher
```

### 2. Instalacja zależności
```bash
npm install
```

### 3. Konfiguracja Ollama
```bash
# Instalacja Ollama (Linux/macOS)
curl -fsSL https://ollama.ai/install.sh | sh

# Lub pobranie z https://ollama.ai/download dla Windows

# Uruchomienie Ollama
ollama serve

# Pobranie modelu (w osobnym terminalu)
ollama pull mistral:7b
```

### 4. Konfiguracja WordPress

#### Generowanie Application Password:
1. Zaloguj się do WordPress Admin
2. Idź do **Użytkownicy → Twój profil**
3. Przewiń do sekcji **"Application Passwords"**
4. Wpisz nazwę aplikacji (np. "Git Publisher")
5. Kliknij **"Add New Application Password"**
6. **Skopiuj wygenerowane hasło** (pokazuje się tylko raz!)

## 🚀 Uruchomienie

### 1. Uruchomienie backend serwera
```bash
npm start
# lub dla developmentu z auto-restartowaniem:
npm run dev
```

### 2. Otwarcie aplikacji webowej
Otwórz przeglądarkę i idź na:
```
http://localhost:3001
```

## 📋 Instrukcja użytkowania

### 1. Konfiguracja WordPress
- **URL WordPress**: `https://twoja-domena.com`
- **Nazwa użytkownika**: Twoja nazwa użytkownika WP
- **Application Password**: Hasło wygenerowane w kroku 4
- Kliknij **"Testuj połączenie"**

### 2. Konfiguracja Ollama
- **URL Ollama**: `http://localhost:11434` (domyślne)
- **Model**: Wybierz dostępny model (np. `mistral:7b`)
- Kliknij **"Testuj Ollama"**

### 3. Konfiguracja Git
- **Ścieżka do folderów GitHub**: `/home/user/github` lub `C:\Users\user\github`
- **Data analizy**: Wybierz datę (domyślnie dzisiaj)
- Kliknij **"Skanuj projekty Git"**

### 4. Generowanie artykułu
- **Opcjonalnie**: Podaj własny tytuł artykułu
- **Kategoria**: Nazwa kategorii WordPress
- **Tagi**: Tagi oddzielone przecinkami
- Kliknij **"Generuj i publikuj artykuł"**

### 5. Publikacja
- Przejrzyj wygenerowany artykuł w sekcji podglądu
- Kliknij **"Publikuj na WordPress"**
- Otrzymasz link do opublikowanego artykułu

## 📁 Struktura projektu

```
wordpress-git-publisher/
├── server.js              # Backend Express.js
├── package.json           # Zależności Node.js
├── public/
│   └── index.html         # Frontend aplikacji
├── README.md             # Ta dokumentacja
└── .gitignore           # Pliki ignorowane przez Git
```

## 🔧 API Endpoints

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/health` | GET | Sprawdzenie stanu serwera |
| `/api/test-wordpress` | POST | Test połączenia z WordPress |
| `/api/test-ollama` | POST | Test połączenia z Ollama |
| `/api/scan-git` | POST | Skanowanie repozytoriów Git |
| `/api/generate-article` | POST | Generowanie artykułu AI |
| `/api/publish-wordpress` | POST | Publikacja na WordPress |

## 📊 Format danych Git

Aplikacja analizuje następujące informacje z commitów:
- **Hash commita** (skrócony i pełny)
- **Wiadomość commita**
- **Autor i email**
- **Data commita**
- **Lista zmienionych plików**
- **Statystyki zmian** (+/- linii)
- **Aktualna gałąź**
- **URL zdalnego repozytorium**

## 🎨 Przykład wygenerowanego artykułu

```html
<h1>Postępy w projektach - 2025-06-04</h1>

<p>Dzisiaj był produktywny dzień w moich projektach programistycznych...</p>

<h2>Projekt: wordpress-publisher</h2>
<p>W projekcie wordpress-publisher zrealizowałem następujące zadania:</p>
<ul>
  <li>Dodano system autoryzacji OAuth (auth.js, auth.test.js)</li>
  <li>Naprawiono błąd połączenia z bazą danych (db.js)</li>
</ul>

<h2>Podsumowanie</h2>
<p>Łącznie dzisiaj wykonałem 5 commitów w 2 projektach...</p>
```

## 🛡️ Bezpieczeństwo

- **Application Passwords** zamiast zwykłych haseł WordPress
- **Lokalne przetwarzanie** - dane Git nie opuszczają Twojego serwera
- **HTTPS zalecane** dla produkcji
- **Walidacja danych** na wszystkich endpointach API

## 🔧 Rozwiązywanie problemów

### Błąd: "Ollama nie odpowiada"
```bash
# Sprawdź czy Ollama działa
ollama list

# Uruchom Ollama jeśli nie działa
ollama serve
```

### Błąd: "Brak modelu mistral:7b"
```bash
# Pobierz wymagany model
ollama pull mistral:7b

# Sprawdź dostępne modele
ollama list
```

### Błąd: "WordPress 401 Unauthorized"
1. Sprawdź czy Application Password jest poprawne
2. Upewnij się, że użytkownik ma uprawnienia do publikowania
3. Sprawdź czy WordPress REST API jest włączone

### Błąd: "Nie znaleziono repozytoriów Git"
1. Sprawdź ścieżkę do folderów GitHub
2. Upewnij się, że foldery zawierają repozytoria Git (folder .git)
3. Sprawdź uprawnienia do odczytu folderów

## 🚀 Development

### Tryb developmentu
```bash
npm run dev  # Nodemon z auto-restartowaniem
```

### Uruchomienie testów
```bash
npm test
```

### Linting kodu
```bash
npm run lint
```

## 📄 Licencja

MIT License - zobacz plik LICENSE

## 🤝 Wsparcie

W razie problemów:
1. Sprawdź sekcję rozwiązywania problemów
2. Sprawdź logi w konsoli przeglądarki i terminalu
3. Otwórz issue na GitHub

## 🔄 Aktualizacje

Aby zaktualizować aplikację:
```bash
git pull origin main
npm install
npm restart
```

---

**Autor**: Twój Developer  
**Wersja**: 1.0.0  
**Data**: 2025-06-04