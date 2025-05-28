import type { NextRequest } from "next/server"

interface MonopolyEvent {
  name: string
  startTime: string
  endTime: string
  duration: string
  type?: string
  imageUrl?: string
}

interface EventsByDate {
  [date: string]: MonopolyEvent[]
}

interface ScrapingMethod {
  name: string
  status: "pending" | "running" | "success" | "failed"
  result?: any
  error?: string
  duration?: number
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const methods: ScrapingMethod[] = [
        { name: "Puppeteer Browser Automation", status: "pending" },
        { name: "Wait for Dynamic Content", status: "pending" },
        { name: "Extract Events from DOM", status: "pending" },
        { name: "Parse Event Details", status: "pending" },
        { name: "Format JSON Output", status: "pending" },
      ]

      const sendProgress = (progress: number, updatedMethods: ScrapingMethod[]) => {
        const data =
          JSON.stringify({
            type: "progress",
            progress,
            methods: updatedMethods,
          }) + "\n"
        controller.enqueue(encoder.encode(data))
      }

      const sendFinal = (success: boolean, events?: EventsByDate, successfulMethod?: string, error?: string) => {
        const data =
          JSON.stringify({
            type: "final",
            success,
            events,
            successfulMethod,
            error,
          }) + "\n"
        controller.enqueue(encoder.encode(data))
        controller.close()
      }

      let browser: any = null

      try {
        // Method 1: Launch Puppeteer Browser
        methods[0].status = "running"
        sendProgress(10, [...methods])

        const startTime = Date.now()

        // Dynamic import of puppeteer (since it might not be available in all environments)
        let puppeteer: any
        try {
          puppeteer = await import("puppeteer")
        } catch (error) {
          throw new Error("Puppeteer not available. Using fallback method with simulated browser behavior.")
        }

        // Launch browser with stealth settings
        browser = await puppeteer.default.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
          ],
        })

        methods[0].status = "success"
        methods[0].duration = Date.now() - startTime
        methods[0].result = { browserLaunched: true }

        sendProgress(25, [...methods])

        // Method 2: Navigate and Wait for Content
        methods[1].status = "running"
        const method2StartTime = Date.now()

        const page = await browser.newPage()

        // Set realistic viewport and user agent
        await page.setViewport({ width: 1366, height: 768 })
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )

        // Set extra headers
        await page.setExtraHTTPHeaders({
          "Accept-Language": "en-US,en;q=0.9",
          DNT: "1",
        })

        // Navigate to the page
        await page.goto("https://monopolygo.game/monopoly-go-events-today-schedule", {
          waitUntil: "networkidle2",
          timeout: 30000,
        })

        // Wait for the specific selector to appear
        await page.waitForSelector("ul.events_eventBox__nV6sM", { timeout: 15000 })

        // Additional wait for dynamic content to fully load
        await page.waitForTimeout(3000)

        methods[1].status = "success"
        methods[1].duration = Date.now() - method2StartTime
        methods[1].result = { pageLoaded: true }

        sendProgress(50, [...methods])

        // Method 3: Extract Events from DOM
        methods[2].status = "running"
        const method3StartTime = Date.now()

        // Extract events using page.evaluate to run code in browser context
        const rawEventData = await page.evaluate(() => {
          const eventBox = document.querySelector("ul.events_eventBox__nV6sM")
          if (!eventBox) return { error: "Event box not found" }

          const events: any[] = []

          // Get all list items (date sections)
          const dateItems = eventBox.querySelectorAll("li")

          dateItems.forEach((li) => {
            // Get date header
            const dateSpan = li.querySelector("span")
            if (!dateSpan) return

            const dateText = dateSpan.textContent?.trim() || ""
            if (!dateText.includes("Events for")) return

            const dateMatch = dateText.match(/Events for (.+)/)
            if (!dateMatch) return

            const dateStr = dateMatch[1]

            // Find all images (events) in this date section
            const images = li.querySelectorAll("img")

            images.forEach((img) => {
              const eventName = img.getAttribute("title") || img.getAttribute("alt") || ""
              if (!eventName) return

              // Clean event name
              const cleanName = eventName.replace("Monopoly Go Event Name: ", "").trim()

              // Find the event container
              const eventContainer = img.closest("div")?.parentElement
              if (!eventContainer) return

              // Look for time information
              let timeText = ""
              let durationText = ""

              // Search all divs in the container for time and duration
              const allDivs = eventContainer.querySelectorAll("div")
              allDivs.forEach((div) => {
                const text = div.textContent?.trim() || ""

                // Look for time pattern
                if (text.match(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} - \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/)) {
                  timeText = text
                }

                // Look for duration
                if (text.includes("Duration:")) {
                  durationText = text
                }
              })

              // Get image URL
              const imageUrl = img.getAttribute("src") || ""

              events.push({
                date: dateStr,
                name: cleanName,
                timeText,
                durationText,
                imageUrl,
              })
            })
          })

          return { events, totalFound: events.length }
        })

        if (rawEventData.error) {
          throw new Error(rawEventData.error)
        }

        methods[2].status = "success"
        methods[2].duration = Date.now() - method3StartTime
        methods[2].result = { eventsFound: rawEventData.totalFound }

        sendProgress(75, [...methods])

        // Method 4: Parse Event Details
        methods[3].status = "running"
        const method4StartTime = Date.now()

        const eventsByDate: EventsByDate = {}

        rawEventData.events.forEach((event: any) => {
          try {
            // Convert date string to ISO format
            const date = new Date(event.date)
            const formattedDate = date.toISOString().split("T")[0]

            if (!eventsByDate[formattedDate]) {
              eventsByDate[formattedDate] = []
            }

            // Parse time range
            const timeMatch = event.timeText.match(
              /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) - (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/,
            )

            if (!timeMatch) return

            const startTimeStr = timeMatch[1].replace(/\//g, "-").replace(" ", "T")
            const endTimeStr = timeMatch[2].replace(/\//g, "-").replace(" ", "T")

            // Parse duration
            const durationMatch = event.durationText.match(/Duration:\s*(.+)/)
            const duration = durationMatch ? durationMatch[1].trim() : "Unknown"

            // Determine event type
            let eventType = "Event"
            const name = event.name.toLowerCase()
            if (name.includes("milestone")) eventType = "Milestone"
            else if (name.includes("partners") || name.includes("jedi")) eventType = "Partner Event"
            else if (name.includes("bash") || name.includes("builders")) eventType = "Tournament"
            else if (name.includes("roller") || name.includes("high")) eventType = "Quick Event"
            else if (name.includes("heist") || name.includes("mega")) eventType = "Tournament"
            else if (name.includes("chance") || name.includes("lucky")) eventType = "Quick Event"
            else if (name.includes("season") || name.includes("league")) eventType = "Season"
            else if (name.includes("blitz") || name.includes("golden")) eventType = "Special Event"
            else if (name.includes("boom") || name.includes("sticker")) eventType = "Special Event"

            const monopolyEvent: MonopolyEvent = {
              name: event.name,
              startTime: startTimeStr,
              endTime: endTimeStr,
              duration,
              type: eventType,
              imageUrl: event.imageUrl.startsWith("http") ? event.imageUrl : `https://monopolygo.game${event.imageUrl}`,
            }

            eventsByDate[formattedDate].push(monopolyEvent)
          } catch (error) {
            console.error("Error parsing event:", event, error)
          }
        })

        methods[3].status = "success"
        methods[3].duration = Date.now() - method4StartTime
        methods[3].result = {
          totalEvents: Object.values(eventsByDate).flat().length,
          totalDates: Object.keys(eventsByDate).length,
        }

        sendProgress(90, [...methods])

        // Method 5: Format JSON Output
        methods[4].status = "running"
        const method5StartTime = Date.now()

        // Sort events by date and time
        const sortedEventsByDate: EventsByDate = {}
        Object.keys(eventsByDate)
          .sort()
          .forEach((date) => {
            sortedEventsByDate[date] = eventsByDate[date].sort((a, b) => a.startTime.localeCompare(b.startTime))
          })

        methods[4].status = "success"
        methods[4].duration = Date.now() - method5StartTime
        methods[4].result = { formatted: true }

        sendProgress(100, [...methods])

        // Close browser
        await browser.close()

        sendFinal(true, sortedEventsByDate, "Puppeteer Browser Automation")
      } catch (error) {
        // Close browser if it was opened
        if (browser) {
          try {
            await browser.close()
          } catch (e) {
            console.error("Error closing browser:", e)
          }
        }

        // Mark current method as failed
        const currentMethod = methods.find((m) => m.status === "running")
        if (currentMethod) {
          currentMethod.status = "failed"
          currentMethod.error = error instanceof Error ? error.message : "Unknown error"
        }

        // If Puppeteer is not available, provide fallback with sample data
        if (error instanceof Error && error.message.includes("Puppeteer not available")) {
          sendProgress(100, [...methods])

          // Provide sample data that matches the expected format
          const sampleEvents: EventsByDate = {
            "2025-05-29": [
              {
                name: "High Roller",
                startTime: "2025-05-29T01:00:00",
                endTime: "2025-05-29T06:59:00",
                duration: "5 Minutes",
                type: "Quick Event",
                imageUrl: "https://api.monopolygo.game/storage/v1/object/public/event/icon/highroller.png",
              },
              {
                name: "Mega Heist",
                startTime: "2025-05-29T07:00:00",
                endTime: "2025-05-29T12:59:00",
                duration: "45 Minutes",
                type: "Tournament",
                imageUrl: "https://api.monopolygo.game/storage/v1/object/public/event/icon/heist.png",
              },
            ],
            "2025-05-30": [
              {
                name: "Golden Blitz",
                startTime: "2025-05-30T13:00:00",
                endTime: "2025-05-31T12:59:59",
                duration: "Whole Time",
                type: "Special Event",
                imageUrl: "https://api.monopolygo.game/storage/v1/object/public/event/icon/goldsticker.png",
              },
            ],
          }

          sendFinal(
            false,
            sampleEvents,
            undefined,
            "Puppeteer not available in this environment. Sample data provided. To get real data, deploy this app to a server with Puppeteer support.",
          )
        } else {
          sendProgress(100, [...methods])
          sendFinal(false, undefined, undefined, error instanceof Error ? error.message : "Unknown error occurred")
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  })
}
