
<%
    data = list( hda.datatype.dataprovider( hda, 'json',
        start1=start1,
        start2=start2,
        window_size=window_size,
        min_resolution=min_resolution,
        max_resolution=max_resolution
    ))
    print dict(
        start1=start1,
        start2=start2,
        window_size=window_size,
        min_resolution=min_resolution,
        max_resolution=max_resolution
    )

    dom_id = '-'.join([ visualization_name, query.get( 'dataset_id' ) ])
    canvas_width = 500
    canvas_height = 500
%>

## ----------------------------------------------------------------------------
<!DOCTYPE HTML>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>${ visualization_display_name }</title>
    ${h.js(
        'libs/jquery/jquery',
        'libs/underscore',
        'libs/backbone/backbone',
        'libs/require'
    )}
    <script type="text/javascript" src="/plugins/visualizations/mrheatmap/static/colors.js"></script>
    <script type="text/javascript" src="/plugins/visualizations/mrheatmap/static/pan-and-zoom.js"></script>
    <script type="text/javascript" src="/plugins/visualizations/mrheatmap/static/backbone-heatmap.js"></script>

    ${ h.css( 'base' ) }
    <style>
        html, body, * {
            margin: 0;
            padding: 0;
        }
        canvas {
            border: 1px solid lightgrey;
        }
        canvas, .info {
            float: left;
            margin-right: 8px;
        }
        h4 {
            font-size: 100%;
            color: grey;
            margin: -4px 0px 16px 0px;
        }
        td:nth-child(1) {
            text-align: right;
            padding-right: 8px;
        }
        input[type=number] {
            border: 0px solid lightgrey;
            border-bottom-width: 1px;
            padding: 2px;
        }
    </style>
</head>


## ----------------------------------------------------------------------------
<body>
    <div id="${ dom_id }" class="enclosing">
        <canvas class="${ visualization_name }"></canvas>
        <div class="info">
            <h3>${ hda.name }</h3>
            %if hda.info:
            <h4>${ hda.info }</h4>
            %endif
        </div>
    </div>
    <script type="text/javascript">
        var data = ${ h.dumps( data, indent=2 ) };
        window.view = new MRHStandaloneVisualization({
            el      : $( '#${ dom_id }' ),
            model   : new MRHConfig({
                dataConfig : {
                    source : {
                        dataset_id      : "${ query.get( 'dataset_id' ) }",
                    },
                    provider : {
                        start1          : ${ start1 },
                        start2          : ${ start2 },
                        window_size     : ${ window_size },
                        min_resolution  : ${ min_resolution },
                        max_resolution  : ${ max_resolution },
                        expected_min    : ${ expected_min },
                        expected_max    : ${ expected_max },
                    },
                },
                renderConfig : {
                    canvasWidth     : ${ canvas_width },
                    canvasHeight    : ${ canvas_height },
                }
            }),
        });
        view.render( data );
    </script>
</body>
</html>
