import "dotenv/config";
import express from "express";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // クラウドの DB に繋ぐための「合言葉」じゃ
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 8888;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  try {
    // もしここでエラーが出るなら、Userモデルが読み込めておらん
    const users = await prisma.user.findMany();
    res.render("index", { users });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send(
        "データベースの User モデルが見つかりません。schema.prisma を確認して npx prisma generate を実行してください。",
      );
  }
});

app.post("/users", async (req, res) => {
  const name = req.body.name;
  if (name) {
    await prisma.user.create({ data: { name } });
  }
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
