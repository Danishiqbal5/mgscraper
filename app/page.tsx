"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Download, Clock, Info, RefreshCw, Globe, Timer } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

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

interface ApiResponse {
  success: boolean
  events?: EventsByDate
  methods?: ScrapingMethod[]
  successfulMethod?: string
  totalMethods?: number
  error?: string
}

export default function MonopolyGoScraper() {
  const [events, setEvents] = useState<EventsByDate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrapingMethods, setScrapingMethods] = useState<ScrapingMethod[]>([])
  const [progress, setProgress] = useState(0)
  const [successfulMethod, setSuccessfulMethod] = useState<string | null>(null)
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null)

  const scrapeEvents = async () => {
    setLoading(true)
    setError(null)
    setEvents(null)
    setScrapingMethods([])
    setProgress(0)
    setSuccessfulMethod(null)
    setEstimatedTime(45) // Estimated 45 seconds for browser automation

    const startTime = Date.now()

    try {
      const response = await fetch("/api/scrape-events")

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete JSON objects
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line)

              if (data.type === "progress") {
                setProgress(data.progress)
                setScrapingMethods(data.methods || [])

                // Update estimated time based on progress
                const elapsed = (Date.now() - startTime) / 1000
                const remaining = data.progress > 0 ? (elapsed / data.progress) * (100 - data.progress) : 45
                setEstimatedTime(Math.max(0, Math.round(remaining)))
              } else if (data.type === "final") {
                if (data.success && data.events) {
                  setEvents(data.events)
                  setSuccessfulMethod(data.successfulMethod)
                } else {
                  setError(data.error || "Failed to scrape events")
                }
                setEstimatedTime(0)
              }
            } catch (e) {
              console.error("Failed to parse JSON:", e)
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setEstimatedTime(0)
    } finally {
      setLoading(false)
    }
  }

  const downloadJSON = () => {
    if (!events) return

    const dataStr = JSON.stringify(events, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `monopoly-go-events-${new Date().toISOString().split("T")[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-500"
      case "failed":
        return "bg-red-500"
      case "running":
        return "bg-blue-500"
      default:
        return "bg-gray-300"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return "✓"
      case "failed":
        return "✗"
      case "running":
        return <Loader2 className="h-3 w-3 animate-spin" />
      default:
        return "○"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            <Globe className="inline-block mr-3 h-10 w-10" />
            Monopoly Go Browser Scraper
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Advanced browser automation to extract real-time event data after content loads
          </p>

          <div className="flex gap-4 justify-center">
            <Button onClick={scrapeEvents} disabled={loading} size="lg" className="bg-red-600 hover:bg-red-700">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Browser Running...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Launch Browser & Scrape
                </>
              )}
            </Button>

            {events && (
              <Button onClick={downloadJSON} variant="outline" size="lg">
                <Download className="mr-2 h-4 w-4" />
                Download JSON
              </Button>
            )}
          </div>

          {loading && estimatedTime !== null && estimatedTime > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
              <Timer className="h-4 w-4" />
              Estimated time remaining: {estimatedTime} seconds
            </div>
          )}
        </div>

        {/* Browser Automation Info */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Globe className="h-4 w-4" />
          <AlertDescription className="text-blue-800">
            <strong>Browser Automation:</strong> This scraper launches a real browser, waits for content to load, and
            extracts live data. Process may take 30-60 seconds.
          </AlertDescription>
        </Alert>

        {loading && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Browser Automation Progress
              </CardTitle>
              <CardDescription>Launching headless browser and waiting for dynamic content to load...</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="mb-4" />
              <div className="space-y-2">
                {scrapingMethods.map((method, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded border">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(method.status)}`} />
                    <span className="flex-1 font-medium">{method.name}</span>
                    <span className="text-sm text-gray-500">{getStatusIcon(method.status)}</span>
                    {method.duration && <span className="text-xs text-gray-400">{method.duration}ms</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {successfulMethod && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-green-800">
              <strong>Success!</strong> Real data extracted using: {successfulMethod}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="events" className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="events">Event Data</TabsTrigger>
            <TabsTrigger value="methods">Browser Steps</TabsTrigger>
            <TabsTrigger value="json">Raw JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            {events ? (
              <div className="space-y-6">
                <div className="text-center">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    Found {Object.keys(events).length} event dates with {Object.values(events).flat().length} total
                    events
                  </Badge>
                </div>

                {Object.entries(events).map(([date, dayEvents]) => (
                  <Card key={date} className="shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white">
                      <CardTitle className="text-xl">Events for {formatDate(date)}</CardTitle>
                      <CardDescription className="text-yellow-100">
                        {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""} scheduled
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid gap-4">
                        {dayEvents.map((event, index) => (
                          <div
                            key={index}
                            className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {event.imageUrl && (
                                  <img
                                    src={event.imageUrl || "/placeholder.svg"}
                                    alt={event.name}
                                    className="w-8 h-8 rounded"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none"
                                    }}
                                  />
                                )}
                                <h3 className="font-semibold text-lg text-gray-900">{event.name}</h3>
                              </div>
                              {event.type && <Badge variant="outline">{event.type}</Badge>}
                            </div>

                            <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>
                                  {formatTime(event.startTime)} - {formatTime(event.endTime)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  Duration: {event.duration}
                                </Badge>
                              </div>
                            </div>

                            <div className="mt-3 text-xs text-gray-500 font-mono">
                              {event.startTime} - {event.endTime}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  No event data available. Click "Launch Browser & Scrape" to begin extraction.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="methods">
            <Card>
              <CardHeader>
                <CardTitle>Browser Automation Steps</CardTitle>
                <CardDescription>Detailed breakdown of the browser automation process</CardDescription>
              </CardHeader>
              <CardContent>
                {scrapingMethods.length > 0 ? (
                  <div className="space-y-4">
                    {scrapingMethods.map((method, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{method.name}</h3>
                          <Badge
                            variant={
                              method.status === "success"
                                ? "default"
                                : method.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {method.status}
                          </Badge>
                        </div>
                        {method.error && <p className="text-sm text-red-600 mb-2">{method.error}</p>}
                        {method.duration && (
                          <p className="text-xs text-gray-500">Execution time: {method.duration}ms</p>
                        )}
                        {method.result && (
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-32">
                            {JSON.stringify(method.result, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No browser automation attempts yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json">
            <Card>
              <CardHeader>
                <CardTitle>Raw JSON Output</CardTitle>
                <CardDescription>Copy this JSON data or download it using the button above</CardDescription>
              </CardHeader>
              <CardContent>
                {events ? (
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-sm max-h-96">
                    {JSON.stringify(events, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-500 text-center py-8">No JSON data available yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
