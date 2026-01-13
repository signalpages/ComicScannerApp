
export const runtime = 'nodejs';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const issue = searchParams.get('issue');

    if (!title) {
        return Response.json({ ok: false, error: 'Missing title parameter' }, { status: 400 });
    }

    // Mock Search Logic
    const candidates = [
        {
            editionId: `manual-${title}-${issue || '1'}-A`,
            displayName: `${title} #${issue || '1'}`,
            coverUrl: null,
            variantHint: "Cover A",
            year: null,
            publisher: "Unknown"
        },
    ];

    return Response.json({
        ok: true,
        candidates,
        variantRisk: "MEDIUM"
    });
}
