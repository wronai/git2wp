# Git2WP - Lista zadań do wykonania

## Priorytet 1: Podstawowa funkcjonalność
- [ ] Naprawa skanowania repozytoriów
  - [ ] Implementacja pełnej ścieżki skanowania katalogów GitHub
  - [ ] Obsługa błędów i komunikatów dla użytkownika
  - [ ] Wyświetlanie listy dostępnych repozytoriów

- [ ] Integracja z WordPress
  - [ ] Testy połączenia z WordPress REST API
  - [ ] Implementacja tworzenia postów
  - [ ] Obsługa aktualizacji istniejących postów
  - [ ] Walidacja tokenu i uprawnień

- [ ] Obsługa Git
  - [ ] Pobieranie historii commitów
  - [ ] Analiza zmian w plikach
  - [ ] Generowanie podsumowania zmian

## Priorytet 2: Ulepszenia interfejsu użytkownika
- [ ] Dodanie podglądu zmian przed publikacją
- [ ] Implementacja wyboru zakresu commitów do publikacji
- [ ] Dodanie podglądu formatowania artykułu
- [ ] Ulepszenie systemu logów
- [ ] Dodanie ciemnego motywu
- [ ] Responsywność na urządzeniach mobilnych

## Priorytet 3: Integracja z AI (Ollama)
- [ ] Konfiguracja połączenia z Ollama API
- [ ] Generowanie podsumowań commitów
- [ ] Automatyczne tagowanie treści
- [ ] Sugestie kategorii
- [ ] Generowanie obrazów na podstawie treści

## Priorytet 4: Testy i zabezpieczenia
- [ ] Testy jednostkowe API
- [ ] Testy integracyjne
- [ ] Walidacja danych wejściowych
- [ ] Obsługa błędów i wyjątków
- [ ] Logowanie zdarzeń

## Priorytet 5: Dokumentacja i wdrożenie
- [ ] Aktualizacja README.md
- [ ] Dokumentacja API
- [ ] Instrukcja konfiguracji
- [ ] Skrypty wdrożeniowe
- [ ] Konfiguracja CI/CD

## Priorytet 6: Optymalizacje
- [ ] Buforowanie wyników skanowania
- [ ] Optymalizacja zapytań do API WordPress
- [ ] Lazy loading komponentów UI
- [ ] Kompresja zasobów statycznych

## Uwagi:
- Wszystkie hasła i tokeny muszą być przechowywane bezpiecznie
- Aplikacja powinna działać zarówno lokalnie, jak i w środowisku produkcyjnym
- Należy zadbać o obsługę dużych repozytoriów
- Warto rozważyć dodanie systemu wtyczek dla rozszerzalności
