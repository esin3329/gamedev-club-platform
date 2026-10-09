import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const publicPaths = ['/auth/login', '/auth/callback'];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single();

    if (profile?.status === 'pending') {
      if (!pathname.startsWith('/pending') && !pathname.startsWith('/apply')) {
        const url = request.nextUrl.clone();
        url.pathname = '/pending';
        return NextResponse.redirect(url);
      }
    } else if (profile?.status === 'rejected') {
      if (!pathname.startsWith('/pending')) {
        const url = request.nextUrl.clone();
        url.pathname = '/pending';
        return NextResponse.redirect(url);
      }
    } else if (!profile) {
      if (!pathname.startsWith('/apply')) {
        const url = request.nextUrl.clone();
        url.pathname = '/apply';
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith('/admin')) {
      if (profile?.status !== 'active') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('global_role')
        .eq('id', user.id)
        .single();

      if (adminProfile?.global_role !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
