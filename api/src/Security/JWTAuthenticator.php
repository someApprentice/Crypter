<?php
namespace Crypter\Security;

use Crypter\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;
use Symfony\Component\Security\Guard\AbstractGuardAuthenticator;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;

use \Firebase\JWT\JWT;

class JWTAuthenticator extends AbstractGuardAuthenticator
{
    private $em;

    private $secret;

    public function __construct(EntityManagerInterface $em, ParameterBagInterface $param)
    {
        $this->em = $em;
        $this->secret = $param->get('JWT_SECRET');
    }

    /**
     * Called on every request to decide if this authenticator should be
     * used for the request. Returning false will cause this authenticator
     * to be skipped.
     */
    public function supports(Request $request)
    {
        return $request->headers->has('Authorization');
    }

    /**
     * Called on every request. Return whatever credentials you want to
     * be passed to getUser() as $credentials.
     */
    public function getCredentials(Request $request)
    {
        $token = $request->headers->get('Authorization');

        preg_match('/^Bearer (\S+)$/', $token, $matches);

        $jwt = $matches[1];

        return [
            'token' => $jwt,
        ];
    }

    public function getUser($credentials, UserProviderInterface $userProvider)
    {
        $token = $credentials['token'];

        $payload = JWT::decode($token, $this->secret, array('HS256'));

        if (null === $payload) {
            return;
        }

        // if a User object, checkCredentials() is called
        return $this->em->getRepository(User::class)->find($payload->uuid);
    }

    public function checkCredentials($credentials, UserInterface $user)
    {
        // check credentials - e.g. make sure the password is valid
        // no credential check is needed in this case

        // return true to cause authentication success
        return true;
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, $providerKey)
    {
        // on success, let the request continue
        return null;
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception)
    {
        return new Response('Forbidden', Response::HTTP_FORBIDDEN);
    }

    /**
     * Called when authentication is needed, but it's not sent
     */
    public function start(Request $request, AuthenticationException $authException = null)
    {
        return new Response('Unauthorized', Response::HTTP_UNAUTHORIZED, ['WWW-Authenticate' => 'Bearer']);
    }

    public function supportsRememberMe()
    {
        return false;
    }
}