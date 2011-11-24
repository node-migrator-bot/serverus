Serverus
=====

Serverus is a multi-process server for your git repository.

First you need to initialise serverus:

    serverus init path://to/myrepo.git

A directory called myrepo.serverus will be created under the current directory - inside is a serverus.json file for your build/deploy settings, and a `_repo` directory containing a git checkout of your code.  It might take a few minutes to run this step, as serverus has to do a full `git clone` of your repository.

You probably want to update your settings at this point - edit serverus.json:

    {
        // Command to run before the main script, this will be run in the root directory of your code.
        // This directory will be one level down from your serverus directory, so you can put shared scripts alongside serverus.json and run them with "../"
        "beforeExec": "command",
        // Args to pass to the beforeExec script
        "beforeExecArgs": [],
        // Executable to run - this should be in your system PATH and will be run in the root directory of your code.
        "exec": "node",
        // Arguments to run the executable with
        // the string "$PORT" is special and will be replaced with the port that serverus wants this instance to run on
        "args": ["server.js", "--port=$PORT"],
        // An array of files you don't want to be deployed - serverus will also respect your .gitignore file
        "excludeFromDeploy": [],
        // Branches to run on startup (you can run others on demand)
        "branches": ["master"],
        // Config overrides for various branches
        "master": {
            "args": ["server.js", "--port=80"]
        }
    }

When you're ready to serve your app, use:

    serverus run

Visit `http://localhost:8123/` to see your branches and that's it!

Additional config
====

You can use the `--help` flag to get commandline options for `serverus run`:

    Usage:
      run [OPTIONS] [ARGS]

    Options:
      -p, --port [NUMBER]    Port for serverus to listen on (Default is 8123)
      -s, --startingPort [NUMBER]Port to start branch servers listening on (Default is 8124, or port+1)
      -r, --root [STRING]    Root URL of server instances, affects the URL linked
                             to from the serverus server  (Default is /)
      -d, --domain [STRING]  The domain name to serve branches up as subdomains of  (Default is localhost)
          --force BOOL       Force run, remove __serverus.lock file from
                             checkout if necessary
      -h, --help             Display help and usage details

You can also specify the majority of these options in `serverus.json`, using the full name (eg `port` not `p`).
