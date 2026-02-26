FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy project
COPY . /app/

# Run migrations and collect static files
RUN python manage.py collectstatic --noinput || true

# Expose port
EXPOSE 8003

# Run the application
CMD ["python", "manage.py", "runserver", "0.0.0.0:8003"]
