#!/bin/bash

# TILV AI Engine Startup Script

echo "🚀 Starting TILV AI Engine..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run: python3 -m venv venv"
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "📝 Please edit .env with your configuration"
fi

# Start yield optimizer in background
echo "🤖 Starting Yield Optimizer..."
nohup python yield_optimizer.py > yield_optimizer.log 2>&1 &
echo $! > yield_optimizer.pid

# Start the server
echo "🌐 Starting FastAPI server on port 5000..."
python main.py
