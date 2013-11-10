<h1>1. About this project</h1>
<p>This project aims to implement a transcoding cloud written in node.js. The reason
   for such implementation is the small cpu usage footprint of the node.js and it's low
   resource consuming.
</p>
<h1>2. Project components</h1>

<h2>2.0. First of all: NodeJS modules</h2>
<p>This project depends heavily on <a href="http://nodejs.org">nodejs project</a>, and for being able to run it, you will need
   the following nodejs modules:
</p>
<p>
   <ul>
        <li><b>xmlhttprequest</b> ( tested with 1.6.0 )</li>
        <li><b>websocket</b> ( tested with 1.0.8 )</li>
        <li><b>remove</b> ( tested with 0.1.5 )</li>
        <li><b>mysql</b> ( tested with 2.0.0-alpha-9 )</li>
        <li><b>mmmagic</b> ( tested with 0.3.4 )</li>
        <li><b>mkdirp</b> ( tested with 0.3.5 )</li>
        <li><b>gm</b> ( tested with 1.13.3 )</li>
        <li><b>base64</b> ( tested with 2.1.0 )</li>
        <li><b>nodemailer</b> ( tested with 0.5.5 )</li>
        <li><b>adm-zip</b> ( only for the worker, tested with 0.4.3 )</li>
   </ul>
</p>

<h2>2.1. The API</h2>
<p>The api component is the frontend and the master controller of the cloud. It's task
   is to receive files from clients, and distribute them across cloud storage nodes,
   handle transcoding tasks, create back-notifications to upload clients, etc.
</p>
<p>In a typical environment, only a single api node is required.</p>

<h3>2.1.1 Api software requirements</h3>
<p>The software requirements for the api node are the following:</p>
<ul>
    <li><b>nodejs</b> ( tested with v0.10.3 )</li>
    <li><b>mysql</b> ( tested with v5.5 )</li>
    <li><b>ffmpeg</b> ( built with all formats support )</li>
    <li><b>sendmail</b></li>
</ul>

<h2>2.2. The WORKER</h2>
<p>Worker nodes are servers that transcode uploaded files on the api server in different
   file versions, and store them to the storage servers.
</p>

<h3>2.2.1. Worker software requirements</h3>
<p>The software requirements for the worker node are the following:</p>
<ul>
    <li><b>nodejs</b> ( tested with v0.10.3 )</li>
    <li><b>graphicsmagick</b> ( tested with v.1.3.12-1.1build1 on ubuntu 12.04 )</li>
    <li><b>ffmpeg</b> ( built with all formats support )</li> 
    <li><b>sendmail</b></li>
</ul>

<h2>2.3. The STORAGE</h2>
<p>Storage nodes are servers in the cloud that are storing and serving uploaded files
   on the API and their transcoded versions if needed.
</p>

<h3>2.3.1. Storage software requirements</h3>
<p>The software requirements for a storage node are the following:</p>
<ul>
    <li><b>nodejs</b> ( tested with v0.10.3 )</li>
    <li><b>nginx</b> ( compiled with mp4 module )</li>
    <li><b>sendmail</b></li>
</ul>

<h2>2.4. Drivers available for the cloud clients</h2>
<p>The following connectivity to the could is supported:</p>
<ul>
    <li><b>PHP</b> driver</li>
    <li><b>JavaScript</b> driver ( for browser )</li>
    <li>TODO: <b>JavaScript</b> driver ( for nodejs )</li>
</ul>