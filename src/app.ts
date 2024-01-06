import cron from "node-cron"
import axios from "axios"

console.log(`CRON SERVER START`)
cron.schedule("30 1 * * *", async () => {
    console.log("========== BEGIN CRON JOB ==========")
    console.log("========== END CRON JOB ==========")
})
