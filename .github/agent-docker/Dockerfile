FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@9 --activate

RUN npm install -g opencode-ai

RUN apt-get update && apt-get install -y git ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /workspace /home/opencode
WORKDIR /workspace

COPY opencode.json /home/opencode/opencode.json
COPY agent-prompt.txt /home/opencode/agent-prompt.txt
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

ENV OPENCODE_CONFIG=/home/opencode/opencode.json
ENV HOME=/home/opencode

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
