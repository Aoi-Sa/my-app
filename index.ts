import "dotenv/config";
import express, { Request, Response } from "express";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());

// セッション用のシンプルミドルウェア
app.use((req: any, res: any, next: any) => {
  req.userId = req.query.userId || (req.body && req.body.userId) || null;
  if (req.path === "/login" || req.path === "/register") {
    req.userId = null;
  }
  next();
});

// ========== ページ ==========

// ログインページ
app.get("/login", (req, res) => {
  res.render("login");
});

// 登録ページ
app.get("/register", (req, res) => {
  res.render("register");
});

// ホームページ（ログイン後）
app.get("/", (req: any, res) => {
  const userId = req.query.userId || (req.cookies && req.cookies.userId);
  if (!userId) {
    return res.redirect("/login");
  }
  res.render("index", { userId });
});

// ========== 認証API ==========

// ユーザー登録
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // 既存ユーザーを確認
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: "Email already exists" });
      return;
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email,
      },
    });

    res.status(201).json({ 
      message: "User created successfully",
      userId: user.id,
      email: user.email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ユーザーログイン
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    res.json({ 
      message: "Login successful",
      userId: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ========== タスクAPI ==========

// すべてのタスクを取得
app.get("/api/tasks", async (req: any, res) => {
  try {
    const userId = parseInt(req.query.userId);

    if (!userId) {
      res.status(401).json({ error: "User ID is required" });
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// タスクを作成
app.post("/api/tasks", async (req: any, res) => {
  try {
    const { title, deadline, priority, userId, parent_id } = req.body;

    if (!title || !userId) {
      res.status(400).json({ error: "Title and userId are required" });
      return;
    }

    const task = await prisma.task.create({
      data: {
        title,
        deadline: deadline ? new Date(deadline) : null,
        priority: priority || 3,
        userId: parseInt(userId),
        parent_id: parent_id ? parseInt(parent_id) : null,
      },
    });

    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// タスクを更新
app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, deadline, priority, is_completed, duration_minutes } = req.body;

    const task = await prisma.task.update({
      where: { id: parseInt(id) },
      data: {
        title,
        deadline: deadline ? new Date(deadline) : null,
        priority,
        is_completed,
        duration_minutes: duration_minutes ? parseInt(duration_minutes) : 0,
      },
    });

    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// タスクを削除
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Task deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// ========== ルーティンAPI ==========

// ルーティン一覧を取得
app.get("/api/routines", async (req: any, res) => {
  try {
    const userId = parseInt(req.query.userId);
    if (!userId) {
      res.status(401).json({ error: "User ID is required" });
      return;
    }

    const routines = await prisma.routine.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(routines);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch routines" });
  }
});

// ルーティンを作成
app.post("/api/routines", async (req: any, res) => {
  try {
    const { title, userId } = req.body;
    if (!title || !userId) {
      res.status(400).json({ error: "Title and userId are required" });
      return;
    }

    const routine = await prisma.routine.create({
      data: {
        title,
        interval_days: 1, // 毎日
        userId: parseInt(userId),
      },
    });

    res.status(201).json(routine);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create routine" });
  }
});

// ルーティンの完了/未完了の切り替え
app.put("/api/routines/:id/toggle", async (req: any, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body; // boolean

    const routine = await prisma.routine.update({
      where: { id: parseInt(id) },
      data: {
        last_run_at: completed ? new Date() : null,
      },
    });

    res.json(routine);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle routine" });
  }
});

// ルーティンを削除
app.delete("/api/routines/:id", async (req: any, res) => {
  try {
    const { id } = req.params;
    await prisma.routine.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: "Routine deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete routine" });
  }
});

// ルーティンの日ごとの達成ログ一覧を取得
app.get("/api/routines/logs", async (req: any, res) => {
  try {
    const userId = parseInt(req.query.userId);
    if (!userId) {
      res.status(401).json({ error: "User ID is required" });
      return;
    }

    const logs = await prisma.routineLog.findMany({
      where: { userId },
    });

    res.json(logs.map(log => log.date));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch routine logs" });
  }
});

// ルーティンの達成ログを作成
app.post("/api/routines/logs", async (req: any, res) => {
  try {
    const { userId, date } = req.body; // date: "YYYY-MM-DD"
    if (!userId || !date) {
      res.status(400).json({ error: "UserId and date are required" });
      return;
    }

    const log = await prisma.routineLog.upsert({
      where: {
        userId_date: {
          userId: parseInt(userId),
          date,
        },
      },
      update: {},
      create: {
        userId: parseInt(userId),
        date,
      },
    });

    res.status(201).json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save routine log" });
  }
});

// ルーティンの達成ログを削除
app.delete("/api/routines/logs", async (req: any, res) => {
  try {
    const userId = parseInt(req.query.userId);
    const date = req.query.date; // "YYYY-MM-DD"
    if (!userId || !date) {
      res.status(400).json({ error: "UserId and date are required" });
      return;
    }

    await prisma.routineLog.delete({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    res.json({ message: "Routine log deleted successfully" });
  } catch (err) {
    console.error(err);
    res.json({ message: "Routine log already deleted or not found" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
