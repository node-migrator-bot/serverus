Serverus
=====

Loyally serving your git branches since 2011
=====

Serverus is a multi-process server for your code. Simple run serverus on your git repository, and it will serve up each branch under a different URL

Usage: First you need to initialise serverus

    serverus init path://to/myrepo.git

or (while in your local clone)

    serverus init

A directory called myrepo.serverus will be created under the current directory - inside is a serverus.json file with your settings, settings can also be specified on the commandline.

You probably want to check your settings at this point - edit serverus.json:

    {
        // Executable to run - this should be in your system PATH
        "exec": "node",
        // Arguments to run the executable with
        // the string "$PORT" is secial and will be replaced with the port that serverus wants this instance to run on
        "args": ["server.js", "--port $PORT"]
    }

When you're ready to serve your app, run:

    serverus run

On first run, you may have to wait while serverus checks out your source and spins up your server instances.