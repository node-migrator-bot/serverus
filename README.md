Serverus
=====

Loyally serving your git branches since 2011
=====

Serverus is a multi-process server for your code. Simple run serverus on your git repository, and it will serve up each branch under a different URL

Usage: First you need to initialise serverus

    serverus init path://to/myrepo.git

A directory called myrepo.serverus will be created under the current directory - inside is a serverus.json file with your settings, and a `_repo` directory with a git checkout of your code.  It might take a few while to create the git checkout, so be patient.

You probably want to check your settings at this point - edit serverus.json:

    {
        // Command to run before the main script, this will be run in the root directory of your code.
        // This directory will be one level down from your serverus directory, so you can put shared scripts in here and run them with "../"
        "beforeExec": "command",
        // Args to pass to the beforeExec script
        "beforeExecArgs": [],
        // Executable to run - this should be in your system PATH and will be run in the root directory of your code.
        "exec": "node",
        // Arguments to run the executable with
        // the string "$PORT" is special and will be replaced with the port that serverus wants this instance to run on
        "args": ["server.js", "--port $PORT"]
    }

When you're ready to serve your app, run:

    serverus run

Then visit `http://localhost:8123/` to see your branches.  You can use the `--help` flag to get commandline options:

    Usage:
      run [OPTIONS] [ARGS]

    Options: 
      -p, --port [NUMBER]    Port for serverus to listen on (Default is 8123)
      -s, --startingPort [NUMBER]Port to start branch servers listening on (Default is 8124)
      -r, --root [STRING]    Root URL of server instances, affects the URL linked 
                             to from the serverus server  (Default is /)
      -d, --domain [STRING]  The domain name to serve branches up as subdomains of  (Default is localhost)
          --force BOOL       Force run, remove __serverus.lock file from 
                             checkout if necessary 
      -h, --help             Display help and usage details

You can also specify the majority of these options in `serverus.json`, using the full name (eg `port` not `p`).