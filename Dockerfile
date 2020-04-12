FROM node:13.12.0-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm i
RUN apk add --no-cache unrar
COPY . .
EXPOSE 1234
CMD ["node", "index.js"]