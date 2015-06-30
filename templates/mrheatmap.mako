
<%
    canvas_width = 500
    canvas_height = 500

    from galaxy.util.bunch import Bunch
    # hafta use temp vars because mako
    settings = Bunch(
        chrom1=chrom1,
        start1=start1,
        stop1=stop1,
        chrom2=chrom2,
        start2=start2,
        stop2=stop2,
        min_resolution=min_resolution,
        max_resolution=max_resolution
    )
    print settings

    available_chroms = list( hda.datatype.dataprovider( hda, 'json', chromosomes=True ) )[0]
    print available_chroms

    # rework defaults given metadata in file
    if not settings.chrom1:
        settings.chrom1 = available_chroms[ 'chromosomes' ][0]
    if not settings.chrom2:
        settings.chrom2 = available_chroms[ 'chromosomes' ][0]
    print 'chroms:', settings.chrom1, settings.chrom2

    header = list( hda.datatype.dataprovider( hda, 'json', header=True, **settings.__dict__ ) )[0]
    print header

    settings.start1 = settings.start1 or header[ 'start' ]
    settings.start2 = settings.start2 or header[ 'start' ]
    settings.stop1 = settings.stop1 or header[ 'stop' ]
    settings.stop2 = settings.stop2 or header[ 'stop' ]

    blurry_pixel_resolution = canvas_width / 5
    focused_pixel_resolution = canvas_width

    settings.min_resolution = settings.min_resolution or ( settings.stop1 - settings.start1 + 1 )
    settings.max_resolution = settings.max_resolution or ( ( settings.min_resolution - 1 ) / focused_pixel_resolution )
    print settings

    data = list( hda.datatype.dataprovider( hda, 'json', **settings.__dict__ ) )

    dom_id = '-'.join([ visualization_name, query.get( 'dataset_id' ) ])
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
    <script type="text/javascript" src="/plugins/visualizations/mrheatmap/static/composable.js"></script>
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
        window.chroms = ${ h.dumps( available_chroms, indent=2 ) };
        window.header = ${ h.dumps( header, indent=2 ) };
        window.view = new MRHStandaloneVisualization({
            el      : $( '#${ dom_id }' ),
            model   : new MRHConfig({
                dataConfig  : {
                    source  : {
                        chroms      : chroms,
                        // each chrom has a header - use a map
                        headers     : { '${ settings.chrom1 }' : header },
                        dataset_id : "${ query.get( 'dataset_id' ) }",
                    },
                    provider : ${ h.dumps( settings.__dict__, indent=2 ) },
                },
                renderConfig : {
                    canvasWidth  : ${ canvas_width },
                    canvasHeight : ${ canvas_height },
                }
            }),
        });

        window.data = ${ h.dumps( data, indent=2 ) };
        view.render( data );

    </script>
</body>
</html>
