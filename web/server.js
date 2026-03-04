const express = require('express');
const path = require('path');
const dbRoutes = require('./routes/database');
const llmRoutes = require('./routes/llm');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/database', dbRoutes);
app.use('/api/llm', llmRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GenerateCode Web UI running at http://localhost:${PORT}`);
});
