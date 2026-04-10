import type { RecipeV2 } from '@quokka/shared'

import loginFlow from '../recipes/login-flow.qk.json'
import formFill from '../recipes/form-fill.qk.json'
import dataExport from '../recipes/data-export.qk.json'
import search from '../recipes/search.qk.json'
import dashboardNav from '../recipes/dashboard-nav.qk.json'
import ecommerce from '../recipes/ecommerce.qk.json'
import crmUpdate from '../recipes/crm-update.qk.json'
import reportDownload from '../recipes/report-download.qk.json'

export const seedRecipes: RecipeV2[] = [
  loginFlow,
  formFill,
  dataExport,
  search,
  dashboardNav,
  ecommerce,
  crmUpdate,
  reportDownload,
] as RecipeV2[]

export {
  loginFlow,
  formFill,
  dataExport,
  search,
  dashboardNav,
  ecommerce,
  crmUpdate,
  reportDownload,
}
