<?php
namespace Crypter\Security;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

use Symfony\Component\Security\Http\Logout\LogoutSuccessHandlerInterface;

class LogoutSuccessHandler implements LogoutSuccessHandlerInterface
{
    public function onLogoutSuccess(Request $request)
    {
        $response = new Response('OK', Response::HTTP_OK);

        // set secure flag to true when https will implemented
        $response->headers->clearCookie('uuid', $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null);
        $response->headers->clearCookie('email', $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null);
        $response->headers->clearCookie('name', $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null);
        $response->headers->clearCookie('jwt', $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null);

        return $response;
    }
}