import "dotenv/config";
import express from "express";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 8888;

// デフォルトユーザーID（デモ用）
const DEFAULT_USER_ID = 1;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());

// ホームページ
app.get("/", (req, res) => {
  res.render("index");
});

// ========== ユーザーAPI ==========
app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ========== タスクAPI ==========

// すべてのタスクを取得
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// タスクを作成
app.post("/api/tasks", async (req, res) => {
  try {
    const { title, deadline, priority } = req.body;

    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const task = await prisma.task.create({
      data: {
        title,
        deadline: deadline ? new Date(deadline) : null,
        priority: priority || 3,
        userId: DEFAULT_USER_ID,
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
    const { title, deadline, priority, is_completed } = req.body;

    const task = await prisma.task.update({
      where: { id: parseInt(id) },
      data: {
        title,
        deadline: deadline ? new Date(deadline) : null,
        priority,
        is_completed,
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

// ========== ルーチンAPI ==========

// すべてのルーチンを取得
app.get("/api/routines", async (req, res) => {
  try {
    const routines = await prisma.routine.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
    });
    res.json(routines);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch routines" });
  }
});

// ルーチンを作成
app.post("/api/routines", async (req, res) => {
  try {
    const { title, interval_days } = req.body;

    if (!title || !interval_days) {
      res.status(400).json({ error: "Title and interval_days are required" });
      return;
    }

    const routine = await prisma.routine.create({
      data: {
        title,
        interval_days,
        userId: DEFAULT_USER_ID,
      },
    });

    res.status(201).json(routine);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create routine" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
