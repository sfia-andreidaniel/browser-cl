program patch;

uses sysutils, dos, strings, strutils;

function getBinPath( binpath: string ): string;
var i: integer;
    path: string;
    current: string;
begin
    path := getenv( 'PATH' );
    
    current := '';
    
    // writeln( 'path is: ' + path );
    
    for i := 1 to length(path) do
    begin
        
        if ( path[i] = ':' ) then
        begin
        
            if ( current <> '' ) then
            begin
                
                if fileexists( current + '/' + binpath ) then
                begin
                    exit( current + '/' + binpath );
                end;
                
            end;
            
            current := '';
        end else
        begin
            current := current + path[i];
        end;
        
    end;
    
    exit( '' );
end;

var inputFile: string;
    binaryName: string;
    binaryPath: string;
    
    f: text;
    lines: array[ 1..65535 ] of string;
    n: integer;
    i: integer;
    
begin
    
    if ( paramstr( 1 ) = '' ) then
    begin
        writeln( 'Please provide input file' );
        halt(1);
    end else
    begin
        inputFile := paramstr(1);
        if ( not fileExists( inputFile ) ) then
        begin
            writeln('file not found: "' + inputFile + '"' );
            halt(1);
        end;
    end;
    
    if ( paramstr( 2 ) = '' ) then
    begin
        writeln( 'Please provide bin name' );
        halt(1);
    end else
    begin
        binaryName := paramstr(2);
    end;
    
    writeln('patching file: "' + inputFile + '"' );
    writeln('to use binary: "' + binaryName + '"' );
    
    binaryPath := getbinpath( binaryName );
    
    if ( binaryPath = '' ) then
    begin
        
        writeln( 'The executable for ' + binaryName + ' was not found in your system!' );
        halt( 1 );
        
    end;
    
    writeln( '"' + binaryName + '" was found in: "' + binaryPath + '"' );
    
    n := 0;
    
    {$I-}
    assign( f, inputFile );
    reset( f );
    
    if ( IOResult <> 0 ) then
    begin
        writeln( 'Failed to open file "' + inputFile + '". Check if you have read permissions on that file.' );
        halt(1);
    end;
    
    while not eof( f ) do
    begin
        n := n + 1;
        readln( f, lines[n] );
    end;
    close( f );
    {$I+}
    
    if ( ( length( lines[1] ) < 2 ) or ( lines[1][1] <> '#' ) or ( lines[1][2] <> '!' ) ) then
    begin
        
        writeln( 'file "' + inputFile + '" does not seem to be a script file' );
        writeln( 'because it does not start with a #! sequence in the first line' );
        halt(1);
        
    end;
    
    if lines[1] = ( '#!' + binaryPath ) then
    begin
        writeln( 'the file "' + inputFile + '" is allready using "' + binaryPath + '". file was not modified' );
        halt(0);
    end else
    begin
        writeln( 'the file "' + inputFile + '" is using: ' + lines[1] );
    end;
    
    lines[1] := '#!' + binaryPath;
    {$I-}
    assign( f, inputFile );
    rewrite( f );
    if IOResult <> 0 then
    begin
        writeln( 'failed to override file "' + inputFile + '". check if you have permissions on that file.' );
        halt(1);
    end;

    for i := 1 to n do
    begin
        
        writeln( f, lines[i] );
        
    end;
    
    close(f);
    {$I+}
    
    writeln( 'file has been successfully patched!' );
    
end.