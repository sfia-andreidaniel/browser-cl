<h1>In this folder we store configuration</h1>
<p>Api, Worker, and Storage nodes share their configuration files here</p>

<ul>
    <li>(worker) <b>worker-affinity.json</b> - configuration of the worker node, what query
        is doing to the api server when extracting new jobs to process
    </li>
    <li>(api) <b>database.json</b> - api mysql database configuration</li>
    <li>(api) <b>database.sql</b> - mysql database creation code</li>
    <li>(api) <b>file_types.cfg.json</b> - a mapping between the uploaded files
        mime types ( detected by the api node ) and their parsers / extensions
        on the cloud.<br />
        <br />
        if a mime file-type is not found here, the uploaded file will be treated
        as a regular file, and no transcoding processes will be involved.
    </li>
    <li>(worker, api, storage) <b>nitro-client.js</b> - configuration file for all worker, storage and api nodes</li>
    <li>(api) <b>tasks-priorities.json</b> - default priorities of transcoding jobs / tasks.</li>
</ul>