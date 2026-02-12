import { Calendar } from '@/components/calendar/Calendar'
import { Header } from '@/components/layout/Header'

export default function CalendarPage() {
  return (
    <div className="px-4 py-6 pb-24">
      <Header />

      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Calendrier</h2>
        <p className="text-gray-400 text-sm font-medium">
          Suivez votre consommation quotidienne
        </p>
      </div>
      
      <Calendar />
    </div>
  )
}
