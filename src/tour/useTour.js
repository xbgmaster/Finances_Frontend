import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const DONE_KEY = 'tishe.tourDone'
const PENDING_KEY = 'tishe.tourPending'

export const markTourPending = () => localStorage.setItem(PENDING_KEY, '1')
export const isTourPending = () => !!localStorage.getItem(PENDING_KEY)
export const isTourDone = () => !!localStorage.getItem(DONE_KEY)

// ─── Always-present tail ────────────────────────────────────────────────────
const tailSteps = (t) => [
  {
    element: '[data-tour="currency-lens"]',
    popover: { title: t.tour.currencyTitle, description: t.tour.currencyBody, side: 'bottom', align: 'center' },
  },
  {
    element: '[data-tour="help-btn"]',
    popover: { title: t.tour.helpTitle, description: t.tour.helpBody, side: 'top', align: 'start' },
  },
]

// ─── Per-route step sets ─────────────────────────────────────────────────────
function summarySteps(t) {
  return [
    // 1. Brief nav orientation
    { element: '[data-tour="nav-summary"]',  popover: { title: t.tour.summaryTitle,   description: t.tour.summaryNavBody,  side: 'right', align: 'start' } },
    { element: '[data-tour="nav-cards"]',    popover: { title: t.tour.cardsTitle,     description: t.tour.cardsNavBody,    side: 'right', align: 'start' } },
    { element: '[data-tour="nav-expenses"]', popover: { title: t.tour.expensesTitle,  description: t.tour.expensesNavBody, side: 'right', align: 'start' } },
    { element: '[data-tour="nav-credits"]',  popover: { title: t.tour.creditsTitle,   description: t.tour.creditsNavBody,  side: 'right', align: 'start' } },
    // 2. Page content
    { element: '[data-tour="summary-kpis"]', popover: { title: t.tour.summaryKpisTitle, description: t.tour.summaryKpisBody, side: 'bottom', align: 'center' } },
    { element: '[data-tour="summary-budgets"]', popover: { title: t.tour.summaryBudgetsTitle, description: t.tour.summaryBudgetsBody, side: 'top', align: 'center' } },
    { element: '[data-tour="summary-activity"]', popover: { title: t.tour.summaryActivityTitle, description: t.tour.summaryActivityBody, side: 'top', align: 'center' } },
    ...tailSteps(t),
  ]
}

function cardsSteps(t) {
  return [
    { element: '[data-tour="cards-section"]', popover: { title: t.tour.cardsTitle, description: t.tour.cardsPageBody, side: 'bottom', align: 'center' } },
    { element: '[data-tour="cards-add"]',     popover: { title: t.tour.cardsAddTitle, description: t.tour.cardsAddBody, side: 'bottom', align: 'start' } },
    { element: '[data-tour="cards-favorite"]',popover: { title: t.tour.cardsFavTitle, description: t.tour.cardsFavBody, side: 'left',   align: 'center' } },
    ...tailSteps(t),
  ]
}

function expensesSteps(t) {
  return [
    { element: '[data-tour="expenses-filter"]',     popover: { title: t.tour.expensesFilterTitle,     description: t.tour.expensesFilterBody,     side: 'bottom', align: 'start' } },
    { element: '[data-tour="expenses-calendar"]',   popover: { title: t.tour.expensesCalendarTitle,   description: t.tour.expensesCalendarBody,   side: 'top',    align: 'center' } },
    { element: '[data-tour="expenses-categories"]', popover: { title: t.tour.expensesCategoriesTitle, description: t.tour.expensesCategoriesBody, side: 'top',    align: 'center' } },
    { element: '[data-tour="expenses-details"]',    popover: { title: t.tour.expensesDetailsTitle,    description: t.tour.expensesDetailsBody,    side: 'top',    align: 'center' } },
    ...tailSteps(t),
  ]
}

function creditsSteps(t) {
  return [
    { element: '[data-tour="credits-list"]', popover: { title: t.tour.creditsTitle,   description: t.tour.creditsPageBody,  side: 'bottom', align: 'center' } },
    { element: '[data-tour="credits-add"]',  popover: { title: t.tour.creditsAddTitle, description: t.tour.creditsAddBody, side: 'bottom', align: 'start' } },
    ...tailSteps(t),
  ]
}

function budgetSteps(t) {
  return [
    { element: '[data-tour="budget-section"]', popover: { title: t.tour.budgetTitle, description: t.tour.budgetPageBody, side: 'bottom', align: 'center' } },
    ...tailSteps(t),
  ]
}

function projectionsSteps(t) {
  return [
    { element: '[data-tour="projections-section"]', popover: { title: t.tour.projectionsTitle, description: t.tour.projectionsPageBody, side: 'bottom', align: 'center' } },
    ...tailSteps(t),
  ]
}

function payrollSteps(t) {
  return [
    { element: '[data-tour="payroll-jobs"]',    popover: { title: t.tour.payrollJobsTitle,    description: t.tour.payrollJobsBody,    side: 'bottom', align: 'center' } },
    { element: '[data-tour="payroll-calendar"]',popover: { title: t.tour.payrollCalendarTitle,description: t.tour.payrollCalendarBody,side: 'top',    align: 'center' } },
    { element: '[data-tour="payroll-add"]',     popover: { title: t.tour.payrollAddTitle,     description: t.tour.payrollAddBody,     side: 'bottom', align: 'start' } },
    ...tailSteps(t),
  ]
}

function navFallbackSteps(t) {
  return [
    { element: '[data-tour="nav-summary"]',       popover: { title: t.tour.summaryTitle,     description: t.tour.summaryNavBody,   side: 'right', align: 'start' } },
    { element: '[data-tour="nav-cards"]',         popover: { title: t.tour.cardsTitle,       description: t.tour.cardsNavBody,     side: 'right', align: 'start' } },
    { element: '[data-tour="nav-expenses"]',      popover: { title: t.tour.expensesTitle,    description: t.tour.expensesNavBody,  side: 'right', align: 'start' } },
    { element: '[data-tour="nav-credits"]',       popover: { title: t.tour.creditsTitle,     description: t.tour.creditsNavBody,   side: 'right', align: 'start' } },
    { element: '[data-tour="nav-budget"]',        popover: { title: t.tour.budgetTitle,      description: t.tour.budgetBody,       side: 'right', align: 'start' } },
    { element: '[data-tour="nav-projections"]',   popover: { title: t.tour.projectionsTitle, description: t.tour.projectionsBody,  side: 'right', align: 'start' } },
    ...tailSteps(t),
  ]
}

function getSteps(t, route = '/') {
  const raw = (() => {
    if (route === '/' || route === '')         return summarySteps(t)
    if (route.startsWith('/cards'))            return cardsSteps(t)
    if (route.startsWith('/expenses'))         return expensesSteps(t)
    if (route.startsWith('/credits'))          return creditsSteps(t)
    if (route.startsWith('/budget-history'))   return budgetSteps(t)
    if (route.startsWith('/projections'))      return projectionsSteps(t)
    if (route.startsWith('/payroll'))          return payrollSteps(t)
    return navFallbackSteps(t)
  })()
  // Drop steps whose target is missing OR not visible (e.g. sidebar links
  // on mobile when the drawer is closed, or feature-gated nav items).
  return raw.filter((s) => {
    if (!s.element) return true
    const el = document.querySelector(s.element)
    if (!el) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function startTour(t, route) {
  const currentRoute = route ?? window.location.pathname
  const steps = getSteps(t, currentRoute)
  if (steps.length === 0) return

  const d = driver({
    steps,
    animate: true,
    smoothScroll: true,
    overlayOpacity: 0.48,
    stagePadding: 6,
    stageRadius: 10,
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: t.tour.next,
    prevBtnText: t.tour.prev,
    doneBtnText: t.tour.done,
    popoverClass: 'tishe-popover',
    // Mark done after the tour finishes (works for both "done" and "skip").
    onDestroyed: () => {
      localStorage.setItem(DONE_KEY, '1')
      localStorage.removeItem(PENDING_KEY)
    },
  })
  d.drive()
}
