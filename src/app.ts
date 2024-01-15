import cron from "node-cron"
import axios from "axios"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

console.log(`CRON SERVER START`)
cron.schedule("*/30 * * * *", async () => {
    console.log("========== BEGIN CRON JOB ==========")
    if (!process.env.GET_TOKEN_URL || !process.env.SERVICE_ACCOUNT_USERNAME || !process.env.SERVICE_ACCOUNT_PASSWORD
        || !process.env.GET_EVENTS_URL || !process.env.BUCKET || !process.env.BUCKET_KEY_ID || !process.env.BUCKET_KEY
        || !process.env.S3_ENDPOINT || !process.env.BUCKET_REGION || !process.env.ENVIRONMENT
    ) {
        console.log("missing environment variable(s) - aborting cron job")
        return
    }
    const currentDate = getDateString(new Date())
    const lastWeekDate = getDateString(new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000))
    console.log("current date: ", currentDate)
    console.log("last week date: ", lastWeekDate)

    // Obtain a service account token so we can use the keycloak GET /events endpoint //
    const params = new URLSearchParams()
    params.append("grant_type", "client_credentials")
    await axios
        .post(
            process.env.GET_TOKEN_URL, 
            params,
            {
                auth: {
                    username: `${process.env.SERVICE_ACCOUNT_USERNAME}`,
                    password: `${process.env.SERVICE_ACCOUNT_PASSWORD}`
                },
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        )
        .then(async (response) => {
            const accessToken = response?.data?.access_token
            if (!accessToken){
                throw new Error("failed to retrieve access token - aborting")
            }
            const config = {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                  dateFrom: lastWeekDate,
                  dateTo: currentDate,
                  max: 200000
                }
            }
            await axios
                .get(process.env.GET_EVENTS_URL as string, config)
                .then(async (response) => {
                    const events = response.data
                    if (!events){
                        throw new Error("failed to retrieve events - aborting")
                    }
                    console.log("# of events: ", events.length)
                    await uploadFile(events)
                })
        })
        .catch((error) => {
            console.log(error)
            return error
        })
    console.log("========== END CRON JOB ==========")
})

const uploadFile = async(file: any) => {
  try {
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.BUCKET_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.BUCKET_KEY_ID as string,
        secretAccessKey: process.env.BUCKET_KEY as string,
      },
      retryMode: "standard"
    })
    const currentDate = getDateString(new Date())
    const fileID = `${currentDate}-${process.env.ENVIRONMENT}`
    const fileName = `${currentDate}.json`
    const key = `${currentDate}-${process.env.ENVIRONMENT}`
    const params = {
      Bucket: process.env.BUCKET,
      Key: key,
      Body: JSON.stringify(file),
      ContentType: "application/json",
      Metadata: {
        name: fileName,
        id: fileID
      }
    }
    console.log(`sending file ${fileName} with key ${key} and id ${fileID} ...`)
    const response = await client.send(new PutObjectCommand(params))
    console.log("file upload response: ", response)
  } catch (e) {
    console.log(e)
    throw new Error("file upload failed")
  }
}

const getDateString = (date: Date) => {
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0")
  const day = date.getUTCDate().toString().padStart(2, "0")
  const year = date.getUTCFullYear()
  return year + "-" + month + "-" + day
}