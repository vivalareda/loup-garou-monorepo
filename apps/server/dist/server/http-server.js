import { createServer } from 'node:http';
const SUCCESS_CODE = 200;
const httpServer = createServer((_, res) => {
    res.writeHead(SUCCESS_CODE, { 'Content-Type': 'text/plain' });
});
const PORT = process.env.PORT || '3000';
export function startServer() {
    httpServer.listen(Number.parseInt(PORT, 10), '0.0.0.0', () => {
        console.log(`Werewolf Game Server running on port ${PORT}`);
    });
}
export { httpServer };
