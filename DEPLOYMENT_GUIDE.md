# 🚀 Fit Flow Deployment Guide - Google Cloud Run + Aiven

## Architecture Overview
```
Frontend (React):  Google Cloud Storage + CDN
Backend (Django):  Google Cloud Run (Serverless)
Database:          Aiven PostgreSQL
Media Storage:     Google Cloud Storage
```

---

## 📋 Prerequisites

1. **Google Cloud Account**: [console.cloud.google.com](https://console.cloud.google.com)
   - $300 free credit for new users
   - Credit card required (won't be charged without permission)

2. **Aiven Account**: [aiven.io](https://aiven.io)
   - $300 free credit for new users
   - Free tier available

3. **Tools to Install**:
   ```bash
   # Google Cloud SDK
   https://cloud.google.com/sdk/docs/install
   
   # Docker Desktop (for building images)
   https://www.docker.com/products/docker-desktop
   ```

---

## 🗄️ Step 1: Set Up Aiven PostgreSQL Database

### 1.1 Create Aiven Account
1. Go to [aiven.io/signup](https://aiven.io/signup)
2. Sign up and verify email
3. You'll get $300 free credits

### 1.2 Create PostgreSQL Service
1. Click **"Create Service"**
2. Select **PostgreSQL**
3. Choose plan:
   - **Hobbyist** ($0 with credits) - Perfect for testing
   - Cloud: **Google Cloud Platform**
   - Region: **us-central1** (same as Cloud Run)
4. Service name: `fitflow-db`
5. Click **"Create Service"**
6. Wait ~5 minutes for service to start

### 1.3 Get Database Credentials
Once service is running:
1. Click on **"Overview"** tab
2. Note down:
   ```
   Host:     fitflow-db-yourproject.aivencloud.com
   Port:     12345
   Database: defaultdb
   User:     avnadmin
   Password: [shown in UI]
   ```

### 1.4 Create Database for Fit Flow
1. Go to **"Databases"** tab
2. Click **"Add Database"**
3. Name: `fitflow_production`
4. Click **"Add"**

### 1.5 Test Connection (Optional)
```bash
psql "postgres://avnadmin:PASSWORD@HOST:PORT/fitflow_production?sslmode=require"
```

---

## ☁️ Step 2: Set Up Google Cloud Project

### 2.1 Create New Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click project dropdown → **"New Project"**
3. Name: `fitflow-production`
4. Click **"Create"**

### 2.2 Enable Required APIs
```bash
# After installing gcloud CLI, run:
gcloud config set project fitflow-production

# Enable APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  storage-api.googleapis.com \
  storage-component.googleapis.com
```

### 2.3 Set Up Billing (Required)
1. Go to **Billing** in Cloud Console
2. Link billing account
3. **Note**: Won't charge within free tier limits

---

## 🐳 Step 3: Prepare Backend for Deployment

### 3.1 Create Production Requirements
Create/Update `requirements.txt`:
```txt
Django==5.0.1
djangorestframework==3.14.0
django-cors-headers==4.3.1
djangorestframework-simplejwt==5.3.1
Pillow==10.2.0
python-dotenv==1.0.0

# Production dependencies
gunicorn==21.2.0
psycopg2-binary==2.9.9
whitenoise==6.6.0
django-storages==1.14.2
google-cloud-storage==2.14.0
```

### 3.2 Create Dockerfile
Create `Dockerfile` in project root:
```dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Run gunicorn
CMD exec gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 60 config.wsgi:application
```

### 3.3 Create .dockerignore
Create `.dockerignore`:
```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.venv
.env
.git
.gitignore
.coverage
.pytest_cache
db.sqlite3
media/
frontend/
*.log
```

### 3.4 Update Django Settings
Create `config/settings_production.py`:
```python
from .settings import *
import os

# SECURITY
DEBUG = False
SECRET_KEY = os.environ.get('SECRET_KEY')
ALLOWED_HOSTS = [
    '.run.app',  # Cloud Run domains
    'fitflow.com',  # Your custom domain
]

# Database - Aiven PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', 5432),
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'OPTIONS': {
            'sslmode': 'require',
        }
    }
}

# Static files with WhiteNoise
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files - Google Cloud Storage
DEFAULT_FILE_STORAGE = 'storages.backends.gcloud.GoogleCloudStorage'
GS_BUCKET_NAME = os.environ.get('GCS_BUCKET_NAME', 'fitflow-media')
GS_PROJECT_ID = os.environ.get('GCP_PROJECT_ID')

# CORS for frontend
CORS_ALLOWED_ORIGINS = [
    'https://storage.googleapis.com',
    # Add your frontend domain after deployment
]

# CSRF
CSRF_TRUSTED_ORIGINS = [
    'https://*.run.app',
]
```

---

## 🚢 Step 4: Deploy Backend to Cloud Run

### 4.1 Build and Push Docker Image
```bash
# Navigate to project directory
cd c:\Users\husna\Music\Dapp\quality_check_project

# Set project ID
export PROJECT_ID=fitflow-production

# Build and submit to Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/fitflow-backend
```

### 4.2 Deploy to Cloud Run
```bash
# Deploy with environment variables
gcloud run deploy fitflow-backend \
  --image gcr.io/$PROJECT_ID/fitflow-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" \
  --set-env-vars "SECRET_KEY=your-secret-key-here" \
  --set-env-vars "DB_HOST=fitflow-db-yourproject.aivencloud.com" \
  --set-env-vars "DB_PORT=12345" \
  --set-env-vars "DB_NAME=fitflow_production" \
  --set-env-vars "DB_USER=avnadmin" \
  --set-env-vars "DB_PASSWORD=your-aiven-password" \
  --set-env-vars "GCS_BUCKET_NAME=fitflow-media" \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID"
```

**Important:** Replace the placeholder values with your actual Aiven credentials!

### 4.3 Run Database Migrations
```bash
# Get the Cloud Run service URL
SERVICE_URL=$(gcloud run services describe fitflow-backend --region us-central1 --format 'value(status.url)')

# Run migrations (one-time)
gcloud run jobs create migrate-db \
  --image gcr.io/$PROJECT_ID/fitflow-backend \
  --region us-central1 \
  --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" \
  --set-env-vars "DB_HOST=..." \
  --set-env-vars "DB_PORT=..." \
  --set-env-vars "DB_NAME=..." \
  --set-env-vars "DB_USER=..." \
  --set-env-vars "DB_PASSWORD=..." \
  --command python \
  --args manage.py,migrate

# Execute the job
gcloud run jobs execute migrate-db --region us-central1
```

### 4.4 Create Superuser
```bash
# Connect to Cloud Run instance
gcloud run services proxy fitflow-backend --region us-central1

# In another terminal, create superuser
python manage.py createsuperuser --settings=config.settings_production
```

### 4.5 Test Backend
```bash
# Get your backend URL
echo $SERVICE_URL

# Test API
curl $SERVICE_URL/api/
```

---

## 🌐 Step 5: Deploy Frontend to Cloud Storage

### 5.1 Update Frontend Environment
Create `frontend/.env.production`:
```env
VITE_API_URL=https://fitflow-backend-xxxxx-uc.a.run.app
```

### 5.2 Build Frontend
```bash
cd frontend
npm run build
```

### 5.3 Create Cloud Storage Bucket
```bash
# Create bucket for frontend
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://fitflow-frontend/

# Make bucket public
gsutil iam ch allUsers:objectViewer gs://fitflow-frontend

# Enable website configuration
gsutil web set -m index.html -e index.html gs://fitflow-frontend
```

### 5.4 Deploy Frontend
```bash
# Upload build files
gsutil -m rsync -r -d dist/ gs://fitflow-frontend/

# Set cache control
gsutil -m setmeta -h "Cache-Control:public, max-age=3600" gs://fitflow-frontend/**
```

### 5.5 Set Up Cloud CDN (Optional but Recommended)
```bash
# Create backend bucket
gcloud compute backend-buckets create fitflow-frontend-backend \
  --gcs-bucket-name=fitflow-frontend \
  --enable-cdn

# Create URL map
gcloud compute url-maps create fitflow-url-map \
  --default-backend-bucket=fitflow-frontend-backend

# Create HTTP proxy
gcloud compute target-http-proxies create fitflow-http-proxy \
  --url-map=fitflow-url-map

# Create forwarding rule
gcloud compute forwarding-rules create fitflow-http-rule \
  --global \
  --target-http-proxy=fitflow-http-proxy \
  --ports=80
```

---

## 📦 Step 6: Set Up Media Storage

### 6.1 Create Media Bucket
```bash
# Create bucket for media files
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://fitflow-media/

# Set CORS policy (create cors.json first)
gsutil cors set cors.json gs://fitflow-media/
```

Create `cors.json`:
```json
[
  {
    "origin": ["https://fitflow-backend-xxxxx-uc.a.run.app"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

---

## ✅ Step 7: Verification & Testing

### 7.1 Test Backend
```bash
# Health check
curl https://fitflow-backend-xxxxx-uc.a.run.app/api/

# Login
curl -X POST https://fitflow-backend-xxxxx-uc.a.run.app/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}'
```

### 7.2 Test Frontend
1. Open browser to your Cloud Storage URL
2. Try logging in
3. Create a template
4. Upload an image

### 7.3 Monitor Logs
```bash
# Backend logs
gcloud run services logs read fitflow-backend --region us-central1 --limit 50

# Real-time logs
gcloud run services logs tail fitflow-backend --region us-central1
```

---

## 🔒 Step 8: Security & Best Practices

### 8.1 Set Up Secrets Manager (Recommended)
```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Store secret key
echo -n "your-secret-key" | gcloud secrets create django-secret --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding django-secret \
  --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Update Cloud Run to use secrets
gcloud run services update fitflow-backend \
  --update-secrets=SECRET_KEY=django-secret:latest \
  --region us-central1
```

### 8.2 Set Up Custom Domain (Optional)
```bash
# Map custom domain
gcloud run domain-mappings create \
  --service fitflow-backend \
  --domain api.fitflow.com \
  --region us-central1
```

---

## 💰 Cost Monitoring

### Monthly Cost Estimate:
- **Cloud Run**: $0-10 (within free tier for small traffic)
- **Cloud Storage**: $0-5 (5GB free, then $0.020/GB)
- **Cloud Build**: $0 (120 builds/day free)
- **Aiven PostgreSQL**: $0-10 (with free credits)
- **Total**: **~$0-25/month** initially

### Set Up Budget Alerts:
```bash
# Create budget alert at $10
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Fit Flow Budget" \
  --budget-amount=10USD \
  --threshold-rule=percent=80
```

---

## 🔄 Continuous Deployment (Optional)

### Set Up GitHub Actions
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - id: 'auth'
        uses: 'google-github-actions/auth@v1'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'
      
      - name: Deploy to Cloud Run
        run: |
          gcloud builds submit --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/fitflow-backend
          gcloud run deploy fitflow-backend \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/fitflow-backend \
            --region us-central1
```

---

## 📚 Useful Commands

```bash
# View all Cloud Run services
gcloud run services list

# Update environment variables
gcloud run services update fitflow-backend \
  --set-env-vars "NEW_VAR=value" \
  --region us-central1

# Scale manually
gcloud run services update fitflow-backend \
  --max-instances=10 \
  --region us-central1

# Delete service
gcloud run services delete fitflow-backend --region us-central1
```

---

## 🐛 Troubleshooting

### Backend won't start?
- Check logs: `gcloud run services logs read fitflow-backend`
- Verify environment variables
- Test database connection

### Frontend shows CORS errors?
- Update `CORS_ALLOWED_ORIGINS` in Django settings
- Rebuild and redeploy backend

### Images not uploading?
- Check GCS bucket permissions
- Verify `GS_BUCKET_NAME` environment variable
- Check CORS configuration on bucket

---

## 🎉 You're Done!

Your Fit Flow application is now deployed on:
- **Backend**: https://fitflow-backend-xxxxx-uc.a.run.app
- **Frontend**: https://storage.googleapis.com/fitflow-frontend/index.html
- **Database**: Aiven PostgreSQL (managed)

**Next Steps:**
1. Set up custom domain
2. Configure automated backups
3. Set up monitoring and alerts
4. Implement CI/CD
