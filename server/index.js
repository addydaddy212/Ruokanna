import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { recipeRouter } from './routes/recipes.js'
import { fridgeRouter } from './routes/fridge.js'
import { chatRouter } from './routes/chat.js'
import { plannerRouter } from './routes/planner.js'
import { debriefRouter } from './routes/debrief.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '10mb' }))
app.use('/api/recipes', recipeRouter)
app.use('/api/fridge', fridgeRouter)
app.use('/api/chat', chatRouter)
app.use('/api/planner', plannerRouter)
app.use('/api/debrief', debriefRouter)
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`Ruokanna server running on http://localhost:${PORT}`))
