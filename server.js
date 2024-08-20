const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors()); // Habilita o CORS para todas as origens
const PORT = 3000;

const db = new sqlite3.Database('banco-de-dados.db');

// Criar a tabela 'tarefas' no banco de dados
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS tarefas (id INTEGER PRIMARY KEY, tarefa TEXT)");
});

// Criar a tabela 'usuarios' no banco de dados
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, role TEXT)");
});

db.serialize(() => {
    // Criar a tabela tb_agendamento
    db.run(`CREATE TABLE IF NOT EXISTS tb_agendamento (
        n_protocolo INTEGER PRIMARY KEY,
        data_hora_agendamento VARCHAR(20) NOT NULL,
        clinica_agendamento INTEGER,
        unidade_id_unidade INTEGER NOT NULL,
        paciente_cpf INTEGER NOT NULL,
        FOREIGN KEY (paciente_cpf) REFERENCES tb_paciente(cpf),
        FOREIGN KEY (unidade_id_unidade) REFERENCES tb_unidade(id_unidade)
    )`);

    // Criar a tabela tb_clinica
    db.run(`CREATE TABLE IF NOT EXISTS tb_clinica (
        cnpj INTEGER PRIMARY KEY,
        nome_clinica VARCHAR(50) NOT NULL,
        tel_clinica INTEGER NOT NULL,
        conveniada CHAR(1) NOT NULL
    )`);

    // Criar a tabela tb_consultas
    db.run(`CREATE TABLE IF NOT EXISTS tb_consultas (
        id_unidade INTEGER PRIMARY KEY,
        data_hora_consultas INTEGER,
        agendamento_n_protocolo INTEGER NOT NULL,
        FOREIGN KEY (agendamento_n_protocolo) REFERENCES tb_agendamento(n_protocolo)
    )`);

    // Criar a tabela tb_contem
    db.run(`CREATE TABLE IF NOT EXISTS tb_contem (
        agendamento_n_protocolo INTEGER NOT NULL,
        exame_id_exame INTEGER NOT NULL,
        PRIMARY KEY (agendamento_n_protocolo, exame_id_exame),
        FOREIGN KEY (agendamento_n_protocolo) REFERENCES tb_agendamento(n_protocolo),
        FOREIGN KEY (exame_id_exame) REFERENCES tb_exame(id_exame)
    )`);

    // Criar a tabela tb_contrata
    db.run(`CREATE TABLE IF NOT EXISTS tb_contrata (
        paciente_cpf INTEGER NOT NULL,
        convenio_n_beneficiario INTEGER NOT NULL,
        PRIMARY KEY (paciente_cpf, convenio_n_beneficiario),
        FOREIGN KEY (paciente_cpf) REFERENCES tb_paciente(cpf),
        FOREIGN KEY (convenio_n_beneficiario) REFERENCES tb_convenio(n_beneficiario)
    )`);

    // Criar a tabela tb_conveniada
    db.run(`CREATE TABLE IF NOT EXISTS tb_conveniada (
        convenio_n_beneficiario INTEGER NOT NULL,
        clinica_cnpj INTEGER NOT NULL,
        PRIMARY KEY (convenio_n_beneficiario, clinica_cnpj),
        FOREIGN KEY (clinica_cnpj) REFERENCES tb_clinica(cnpj),
        FOREIGN KEY (convenio_n_beneficiario) REFERENCES tb_convenio(n_beneficiario)
    )`);

    // Criar a tabela tb_convenio
    db.run(`CREATE TABLE IF NOT EXISTS tb_convenio (
        n_beneficiario INTEGER PRIMARY KEY,
        plano VARCHAR(30) NOT NULL,
        acomodacao VARCHAR(30) NOT NULL,
        inclusao VARCHAR(10) NOT NULL,
        tipo_contratacao VARCHAR(30) NOT NULL,
        cns INTEGER NOT NULL,
        ans INTEGER NOT NULL
    )`);

    // Criar a tabela tb_exame
    db.run(`CREATE TABLE IF NOT EXISTS tb_exame (
        id_exame INTEGER PRIMARY KEY,
        tipo_exame VARCHAR(60),
        resultado VARCHAR(100)
    )`);

    // Criar a tabela tb_medico
    db.run(`CREATE TABLE IF NOT EXISTS tb_medico (
        crm INTEGER PRIMARY KEY,
        nome_med VARCHAR(150),
        especialidade VARCHAR(50),
        agendamento_n_protocolo INTEGER NOT NULL,
        FOREIGN KEY (agendamento_n_protocolo) REFERENCES tb_agendamento(n_protocolo)
    )`);

    // Criar a tabela tb_paciente
    db.run(`CREATE TABLE IF NOT EXISTS tb_paciente (
        cpf INTEGER PRIMARY KEY,
        nome_completo VARCHAR(100) NOT NULL,
        data_nasc VARCHAR(10) NOT NULL,
        end_paciente VARCHAR(150) NOT NULL,
        tel_paciente INTEGER NOT NULL,
        email_paciente VARCHAR(50)
    )`);

    // Criar a tabela tb_receita
    db.run(`CREATE TABLE IF NOT EXISTS tb_receita (
        id_receita INTEGER NOT NULL,
        encaminhamento VARCHAR(100),
        data_prescricao VARCHAR(10),
        medico_crm INTEGER NOT NULL,
        paciente_cpf INTEGER NOT NULL,
        PRIMARY KEY (id_receita, paciente_cpf),
        FOREIGN KEY (medico_crm) REFERENCES tb_medico(crm),
        FOREIGN KEY (paciente_cpf) REFERENCES tb_paciente(cpf)
    )`);

    // Criar a tabela tb_trabalha
    db.run(`CREATE TABLE IF NOT EXISTS tb_trabalha (
        medico_crm INTEGER NOT NULL,
        clinica_cnpj INTEGER NOT NULL,
        PRIMARY KEY (medico_crm, clinica_cnpj),
        FOREIGN KEY (medico_crm) REFERENCES tb_medico(crm),
        FOREIGN KEY (clinica_cnpj) REFERENCES tb_clinica(cnpj)
    )`);

    // Criar a tabela tb_unidade
    db.run(`CREATE TABLE IF NOT EXISTS tb_unidade (
        id_unidade INTEGER PRIMARY KEY,
        end_unidade VARCHAR(150),
        tipo_exame VARCHAR(100),
        atende CHAR(1),
        clinica_cnpj INTEGER NOT NULL,
        FOREIGN KEY (clinica_cnpj) REFERENCES tb_clinica(cnpj)
    )`);
});

app.use(express.json());

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
app.post('/tarefas', verificarToken, (req, res) => {
    const { tarefa } = req.body;
    // Inserir a nova tarefa no banco de dados
    db.run("INSERT INTO tarefas (tarefa) VALUES (?)", [tarefa], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, tarefa });
    });
});

// Rota para obter todas as tarefas
app.get('/tarefas', verificarToken, (req, res) => {
    // Obter todas as tarefas do banco de dados
    db.all("SELECT * FROM tarefas", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json(rows);
    });
});

// Rota para obter uma tarefa específica
app.get('/tarefas/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    // Obter a tarefa pelo ID
    db.get("SELECT * FROM tarefas WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (row) {
            res.status(200).json(row);
        } else {
            res.status(404).json({ error: 'Tarefa não encontrada!' });
        }
    });
});

// Rota para editar uma tarefa existente
app.put('/tarefas/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { tarefa } = req.body;
    // Atualizar a tarefa com base no ID
    db.run("UPDATE tarefas SET tarefa = ? WHERE id = ?", [tarefa, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes) {
            res.status(200).json({ message: 'Tarefa atualizada com sucesso!' });
        } else {
            res.status(404).json({ error: 'Tarefa não encontrada!' });
        }
    });
});

// Rota para excluir uma tarefa
app.delete('/tarefas/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    // Excluir a tarefa com base no ID
    db.run("DELETE FROM tarefas WHERE id = ?", [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes) {
            res.status(200).json({ message: 'Tarefa removida com sucesso!' });
        } else {
            res.status(404).json({ error: 'Tarefa não encontrada!' });
        }
    });
});

// Rota para registrar um novo usuário
app.post('/registro', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const usuarioExistente = await buscarUsuario(username);
        if (usuarioExistente) {
            return res.status(400).json({ error: 'Usuário já registrado' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await criarUsuario(username, hashedPassword, role);
        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ error: 'Erro no registro de usuário' });
    }
});

// Rota para autenticar o usuário e gerar token JWT
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const usuario = await buscarUsuario(username);
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
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro no login de usuário' });
    }
});

// Função para buscar usuário no banco de dados
const buscarUsuario = (username) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM usuarios WHERE username = ?', [username], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    });
};

// Função para criar um novo usuário no banco de dados
const criarUsuario = (username, password, role) => {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO usuarios (username, password, role) VALUES (?, ?, ?)', [username, password, role], (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
};

// Função para criar uma nova clínica
const criarClinica = (cnpj, nome_clinica, tel_clinica, conveniada) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tb_clinica (cnpj, nome_clinica, tel_clinica, conveniada) VALUES (?, ?, ?, ?)',
            [cnpj, nome_clinica, tel_clinica, conveniada],
            (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }
        );
    });
};

// Função para criar um novo agendamento
const criarAgendamento = (n_protocolo, data_hora_agendamento, clinica_agendamento, unidade_id_unidade, paciente_cpf) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tb_agendamento (n_protocolo, data_hora_agendamento, clinica_agendamento, unidade_id_unidade, paciente_cpf) VALUES (?, ?, ?, ?, ?)',
            [n_protocolo, data_hora_agendamento, clinica_agendamento, unidade_id_unidade, paciente_cpf],
            (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }
        );
    });
};

// Função para criar uma nova consulta
const criarConsulta = (id_unidade, data_hora_consultas, agendamento_n_protocolo) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tb_consultas (id_unidade, data_hora_consultas, agendamento_n_protocolo) VALUES (?, ?, ?)',
            [id_unidade, data_hora_consultas, agendamento_n_protocolo],
            (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }
        );
    });
};

// Função para criar uma nova receita
const criarReceita = (id_receita, encaminhamento, data_prescricao, medico_crm, paciente_cpf) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tb_receita (id_receita, encaminhamento, data_prescricao, medico_crm, paciente_cpf) VALUES (?, ?, ?, ?, ?)',
            [id_receita, encaminhamento, data_prescricao, medico_crm, paciente_cpf],
            (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }
        );
    });
};

// Função para criar um novo paciente
const criarPaciente = (cpf, nome_completo, data_nasc, end_paciente, tel_paciente, email_paciente) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tb_paciente (cpf, nome_completo, data_nasc, end_paciente, tel_paciente, email_paciente) VALUES (?, ?, ?, ?, ?, ?)',
            [cpf, nome_completo, data_nasc, end_paciente, tel_paciente, email_paciente],
            (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }
        );
    });
};

// Função para criar um novo exame
const criarExame = (id_exame, tipo_exame, resultado) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tb_exame (id_exame, tipo_exame, resultado) VALUES (?, ?, ?)',
            [id_exame, tipo_exame, resultado],
            (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }
        );
    });
};

// Função para criar um novo convênio
const criarConvenio = (n_beneficiario, plano, acomodacao, inclusao, tipo_contratacao, cns, ans) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tb_convenio (n_beneficiario, plano, acomodacao, inclusao, tipo_contratacao, cns, ans) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [n_beneficiario, plano, acomodacao, inclusao, tipo_contratacao, cns, ans],
            (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }
        );
    });
};

// Função para criar um novo médico
const criarMedico = (crm, nome_med, especialidade, agendamento_n_protocolo) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tb_medico (crm, nome_med, especialidade, agendamento_n_protocolo) VALUES (?, ?, ?, ?)',
            [crm, nome_med, especialidade, agendamento_n_protocolo],
            (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }
        );
    });
};

// Inicie o servidor Express
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});