# Subir a GitHub e importar en Apify

## 1) Inicializar y subir a GitHub
```bash
git add .
git commit -m "feat: apify multi-source public monitor actor"

git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
git push -u origin main
```

## 2) Importar en Apify
1. En Apify Console ve a `Actors -> Create new`.
2. Elige `Source code from Git repository`.
3. Pega la URL del repo de GitHub.
4. Rama: `main`.
5. Guarda y lanza `Build`.
6. Ejecuta un `Run` con el input del README.

## 3) Actualizaciones
Cada `git push` a `main` disparara un nuevo build si dejas activada la sincronizacion del actor.
