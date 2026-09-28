FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json* ./

RUN npm install --omit=dev --no-audit --no-fund 2>&1

COPY . .

RUN mkdir -p uploads

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const http=require('http');const p=process.env.PORT||3001;const req=http.get('http://localhost:'+p+'/api/health',(res)=>{process.exit(res.statusCode===200?0:1)}).on('error',()=>process.exit(1));setTimeout(()=>{req.destroy();process.exit(1)},4000);"

CMD ["node", "server.js"]