<h1>1. About this project</h1>
<p>This project aims to implement a transcoding cloud written in node.js. The reason
   for such implementation is the small cpu usage footprint of the node.js and it's low
   resource consuming.
</p>
<h1>2. Project components</h1>

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
    <li><b>ffmpeg</b></li> ( built with all formats support )
</ul>

<h2>2.2. The WORKER</h2>
<p>Worker nodes are servers that transcode uploaded files on the api server in different
   file versions, and store them to the storage servers.
</p>
<h3>2.2.1. Worker software requirements</h3>
<p>The software requirements for the worker node are the following:</p>
<ul>
    <li><b>nodejs</b> ( tested with v0.10.3 )</li>
    <li><b>graphicsmagick</b> ( tested with v.1.3.12-1.1build1 on ubuntu 12.04 )
    <li><b>ffmpeg</b></li> ( built with all formats support )
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
</ul>

<h2>2.4. Drivers available for the cloud clients</h2>
<p>The following connectivity to the could is supported:</p>
<ul>
    <li><b>PHP</b> driver</li>
    <li><b>JavaScript</b> driver</li>
</ul>

<h1>3. Flow</h1>
<p>The project has multiple flows:</p>
<h2>3.1. Client point of view flow</h2>
<p>A client instantiates it's driver, and sends a file to the api server. The api server sends
   a response to the client containing the following information:
</p>
<code>{
    "name": &lt;string&gt; // the original uploaded file name
    "size": &lt;string&gt; // the original uploaded file size
    "files": {
        "original": &lt;string&lt;  // the http://... url pointing to original file
        "version_a": &lt;string&lt; // the transcoded version of original file, in format "version_a"
        "version_b": &lt;string&lt; // the transcoded version of original file, in format "version_b"
        ...
        "version_n": &lt;string&lt; // the transcoded version of original file, in format "version_n"
    },
    "uploadId": &lt;integer&lt; // the upload id. Each upload operation has a unique id
}

// Example of versions: "240p.mp4", "webm", "ogv"
</code>

