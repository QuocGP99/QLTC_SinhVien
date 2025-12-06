FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Cập nhật hệ thống
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev git wget vim libglib2.0-0 libsm6 libxrender1 libxext6

# Nâng pip
RUN python3 -m pip install --upgrade pip

# Cài PaddlePaddle GPU phù hợp CUDA 11.8
RUN pip install paddlepaddle-gpu==2.6.1 -i https://mirror.baidu.com/pypi/simple

# Cài PaddleOCR + PPStructure
RUN pip install paddleocr==2.7.0 ppstructure==1.1.0 unidecode

WORKDIR /app
COPY backend /app

RUN pip install -r requirements.txt

CMD ["python3", "wsgi.py"]
