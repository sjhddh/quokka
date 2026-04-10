import { Command } from 'commander'
import dotenv from 'dotenv'
import { initCommand } from './commands/init.js'
import { runCommand } from './commands/run.js'
import { createCommand } from './commands/create.js'
import { planCommand } from './commands/plan.js'
import { demoCommand } from './commands/demo.js'

dotenv.config()

const program = new Command()

program
  .name('quokka')
  .description('LLM-native browser automation CLI')
  .version('0.1.0')

program
  .command('init')
  .description('Scaffold a new Quokka project')
  .action(initCommand)

program
  .command('run <recipe>')
  .description('Run a .qk recipe file or recipe name')
  .option('-p, --provider <type>', 'LLM provider (openai, anthropic, google, flock)')
  .option('-m, --model <model>', 'Model name override')
  .option('--headed', 'Run browser in headed mode')
  .action(runCommand)

program
  .command('create <description>')
  .description('Generate a recipe from a natural language description')
  .option('-p, --provider <type>', 'LLM provider (openai, anthropic, google, flock)')
  .option('-m, --model <model>', 'Model name override')
  .option('-n, --name <name>', 'Recipe name (default: auto-slugified)')
  .action(createCommand)

program
  .command('plan <recipe>')
  .description('Dry-run: show what the planner would do without executing')
  .action(planCommand)

program
  .command('demo')
  .description('Zero-config demo using an env API key')
  .option('--headed', 'Run browser in headed mode')
  .action(demoCommand)

program.parse()
