module.exports = {
    apps: [
        {
            name: 'snaplove-backend',
            script: './src/app.js',
            instances: 'max', 
            exec_mode: 'cluster',

            env: {
                NODE_ENV: 'development',
                PORT: 4000
            },

            env_production: {
                NODE_ENV: 'production',
                PORT: 4000
            },

            log_file: './logs/app.log',
            out_file: './logs/out.log',
            error_file: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            max_memory_restart: '1G',
            min_uptime: '10s', 
            max_restarts: 10, 

            health_check_http: {
                path: '/health',
                port: 4000,
                interval: 30000, 
                timeout: 5000,   
                max_failures: 3 
            },

            watch: false, 
            ignore_watch: ['node_modules', 'logs', 'uploads', 'images'],
            watch_options: {
                followSymlinks: false,
                usePolling: false
            },

            kill_timeout: 5000, 
            wait_ready: true,   
            listen_timeout: 8000, 
            autorestart: true,
            cron_restart: '0 2 * * *', 

            node_args: '--max-old-space-size=1024', 

            merge_logs: true,
            time: true
        }
    ],

    deploy: {
        production: {
            user: 'deploy',
            host: 'your-server-ip',
            ref: 'origin/main',
            repo: 'https://github.com/REZ3X/snaplove_backend.git',
            path: '/var/www/snaplove-backend',
            'pre-deploy-local': '',
            'post-deploy': 'npm ci --production && pm2 reload ecosystem.config.js --env production',
            'pre-setup': ''
        }
    }
};