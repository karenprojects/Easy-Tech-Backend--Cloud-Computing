const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sql = require('mssql');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3000;

// Configuração de conexão ao Azure SQL Database
const dbConfig = {
    user: 'servidor-sqldb-easytech',
    password: 'your_password_here',  // Substitua pela sua senha
    server: 'servidor-sqldb-easytech.database.windows.net',
    database: 'sqldb-easytech-001',
    options: {
        encrypt: true, // Habilitar criptografia para conexão segura
        trustServerCertificate: false
    }
};

// Função para conectar ao banco de dados
const connectToDatabase = async () => {
    try {
        await sql.connect(dbConfig);
        console.log('Conexão com o banco de dados SQL Server estabelecida com sucesso!');
    } catch (err) {
        console.error('Erro ao conectar ao banco de dados SQL Server:', err);
    }
};

// Middleware para verificar e decodificar o token JWT
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ error: 'Nenhum token fornecido.' });
    }
    jwt.verify(token.split(' ')[1], 'secreto', (err, decoded) => {
        if (err) {
            return res.status(500).json({ error: 'Falha ao autenticar o token.' });
        }
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    });
};

// Rota para adicionar uma nova tarefa
app.post('/tarefas', verificarToken, async (req, res) => {
    const { tarefa } = req.body;
    try {
        await sql.query`INSERT INTO tarefas (tarefa) VALUES (${tarefa})`;
        res.status(201).json({ message: 'Tarefa adicionada com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para obter todas as tarefas
app.get('/tarefas', verificarToken, async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM tarefas`;
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para registrar um novo usuário
app.post('/registro', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const usuarioExistente = await sql.query`SELECT * FROM usuarios WHERE username = ${username}`;
        if (usuarioExistente.recordset.length > 0) {
            return res.status(400).json({ error: 'Usuário já registrado' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await sql.query`INSERT INTO usuarios (username, password, role) VALUES (${username}, ${hashedPassword}, ${role})`;
        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro no registro de usuário' });
    }
});

// Rota para autenticar o usuário e gerar token JWT
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await sql.query`SELECT * FROM usuarios WHERE username = ${username}`;
        const usuario = result.recordset[0];
        if (!usuario) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }
        const senhaValida = await bcrypt.compare(password, usuario.password);
        if (!senhaValida) {
            return res.status(401).json({ error: 'Senha incorreta' });
        }
        const token = jwt.sign({ id: usuario.id, username: usuario.username, role: usuario.role }, 'secreto', { expiresIn: '1h' });
        res.status(200).json({ token });
    } catch (error) {
        res.status(500).json({ error: 'Erro no login de usuário' });
    }
});

// Iniciar o servidor
app.listen(PORT, async () => {
    await connectToDatabase();  // Conectar ao banco de dados ao iniciar o servidor
    console.log(`Servidor rodando na porta ${PORT}`);
});
