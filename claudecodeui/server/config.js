// Configuration for persistent data storage
import path from 'path';
import os from 'os';

// Use persistent volume in production, home directory in development
const isProd = process.env.NODE_ENV === 'production';
const DATA_ROOT = isProd ? '/app/data' : os.homedir();

// Ensure all data goes to persistent volume in production
export const PATHS = {
  // Database location
  DB_DIR: isProd ? path.join(DATA_ROOT, 'db') : path.join(os.homedir(), '.claude', 'db'),
  
  // Claude projects location
  CLAUDE_DIR: isProd ? path.join(DATA_ROOT, '.claude') : path.join(os.homedir(), '.claude'),
  CLAUDE_PROJECTS: isProd ? path.join(DATA_ROOT, '.claude', 'projects') : path.join(os.homedir(), '.claude', 'projects'),
  CLAUDE_CONFIG: isProd ? path.join(DATA_ROOT, '.claude', 'project-config.json') : path.join(os.homedir(), '.claude', 'project-config.json'),
  
  // User uploaded projects
  USER_PROJECTS: isProd ? path.join(DATA_ROOT, 'projects') : path.join(os.homedir(), 'projects'),
  
  // Session data
  SESSIONS_DIR: isProd ? path.join(DATA_ROOT, 'sessions') : path.join(os.homedir(), '.claude', 'sessions'),
};

export default PATHS;