FROM node:18

WORKDIR /usr/src/

# Copy source
COPY . .

# Install dependencies
RUN yarn install --production

# Run service
CMD [ "node", "index.js" ]