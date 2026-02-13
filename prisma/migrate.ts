import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function migrate() {
  try {
    console.log('Running database migrations...');
    
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy');
    
    if (stderr) {
      console.error('Warnings:', stderr);
    }
    
    console.log(stdout);
    console.log('Migrations completed successfully');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();