FROM mhart/alpine-node:4.3

WORKDIR /app/

COPY ./package.json ./package.json
RUN npm install

COPY ./ ./
RUN npm run build && rm -Rf ./src/

ENTRYPOINT ["./dist/bin/app.js"]
